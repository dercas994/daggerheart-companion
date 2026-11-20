import { bonusText, featureBonus, featureCosts, featureDamage, type PendingBonus } from '../lib/costs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../App'
import {
  adversaryMarks, battleBudget, battlePointsSpent, DMG_IT, hordeDamage, KIND_IT, loadBestiary, minionValue, newUid, parseDice, RANGE_IT,
} from '../lib/adversaries'
import { massiveThreshold } from '../lib/rules'
import type { Adversary, Campaign, Encounter, EncounterUnit, Roll } from '../lib/types'
import { DiceOverlay } from './Dice'
import { AshBurst } from './Effects'
import { ErrorLine, Pips, Sheet, Spinner, Stepper, useAsync, useToast } from './ui'

const TYPES = ['Solo', 'Bruiser', 'Leader', 'Standard', 'Skulk', 'Ranged', 'Horde', 'Minion', 'Support', 'Social'] as const
const TYPE_IT: Record<string, string> = {
  Solo: 'Solitario', Standard: 'Avversario Base', Skulk: 'Sicario', Bruiser: 'Bruto', Leader: 'Condottiero',
  Minion: 'Seguace', Horde: 'Orda', Social: 'Controparte', Support: 'Supporto', Ranged: 'Tiratore',
}
const fmtAtk = (a: Adversary['atk']) => (typeof a === 'number' ? (a >= 0 ? `+${a}` : `−${-a}`) : String(a))

/** Tiro privato del master: niente database, nessun giocatore lo vede. */
function localRoll(label: string, spec: { groups: { n: number; sides: number }[]; bonus: number }, kind: 'dice' | 'damage', type?: string, adv = false): Roll {
  const d = (sides: number) => 1 + Math.floor(Math.random() * sides)
  const groups = spec.groups.map(g => ({ ...g, rolls: Array.from({ length: g.n }, () => d(g.sides)) }))
  if (adv && groups[0]?.sides === 20) {
    // vantaggio dell'avversario: due d20, tengo il più alto
    const a = groups[0].rolls[0], b = d(20)
    groups[0].rolls = [Math.max(a, b)]
    label += ` (vantaggio: ${a} e ${b})`
  }
  const sum = groups.reduce((s, g) => s + g.rolls.reduce((x, y) => x + y, 0), 0)
  return {
    id: newUid(), campaign_id: '', character_id: null, user_id: '', roller_name: '', label, hope_die: 0, fear_die: 0, adv_die: 0,
    modifier: spec.bonus, total: sum + spec.bonus, outcome: null, kind, dice: { groups, bonus: spec.bonus, crit_bonus: 0 },
    damage_type: kind === 'damage' ? (type === 'mag' ? 'mag' : 'phy') : null, crit: false, created_at: new Date().toISOString(),
  } as Roll
}

export function EncounterTab({ campaignId, campaign, partySize, patchCampaign }: {
  campaignId: string; campaign: Campaign; partySize: number; patchCampaign: (p: Partial<Campaign>) => Promise<void>
}) {
  const { be } = useApp()
  const toast = useToast()
  const [bestiary, setBestiary] = useState<Adversary[] | null>(null)
  const [custom, setCustom] = useState<Adversary[]>([])
  const [list, setList] = useState<Encounter[] | null>(null)
  const [cur, setCur] = useState<Encounter | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingAdv, setEditingAdv] = useState<Adversary | null>(null)
  const [overlay, setOverlay] = useState<Roll | null>(null)
  const [party, setParty] = useState(Math.max(1, partySize))
  const [adjust, setAdjust] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const saveT = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    loadBestiary().then(setBestiary).catch(e => setError(e.message))
    be.listCustomAdversaries().then(setCustom).catch(() => {})
    be.listEncounters(campaignId).then(es => { setList(es); setCur(es.find(e => e.active) ?? es[0] ?? null) }).catch(e => setError(e.message))
  }, [be, campaignId])
  useEffect(() => { if (partySize > 0) setParty(partySize) }, [partySize])

  const all = useMemo(() => [...custom, ...(bestiary ?? [])], [custom, bestiary])
  const byId = useMemo(() => { const m = new Map(all.map(a => [a.id, a])); return (id: string) => m.get(id) }, [all])

  const dirty = useRef(false)
  function update(next: Encounter | ((e: Encounter) => Encounter)) {
    dirty.current = true
    setCur(prev => (prev ? (typeof next === 'function' ? next(prev) : next) : prev))
  }
  // salvataggio automatico (raggruppa i tocchi ravvicinati)
  useEffect(() => {
    if (!cur || !dirty.current) return
    setList(l => (l ?? []).map(e => (e.id === cur.id ? cur : e)))
    clearTimeout(saveT.current)
    const snap = cur
    saveT.current = setTimeout(() => {
      dirty.current = false
      be.saveEncounter(campaignId, { id: snap.id, name: snap.name, units: snap.units, active: snap.active }).catch(e => toast({ text: e.message, tone: 'error' }))
    }, 500)
  }, [cur, be, campaignId, toast])
  const setUnits = (fn: (u: EncounterUnit[]) => EncounterUnit[]) => update(e => ({ ...e, units: fn(e.units) }))

  async function newEncounter() {
    const n = (list?.length ?? 0) + 1
    const e = await be.saveEncounter(campaignId, { name: `Scontro ${n}`, units: [], active: true }).catch(err => { toast({ text: err.message, tone: 'error' }); return null })
    if (e) { setList(l => [e, ...(l ?? [])]); setCur(e) }
  }
  function addUnits(a: Adversary, count: number) {
    if (!cur) return
    update(e => {
      const same = e.units.filter(u => u.adv === a.id).length
      const units = Array.from({ length: count }, (_, i) => ({
        uid: newUid(), adv: a.id, name: same + count > 1 ? `${a.name} ${same + i + 1}` : a.name, hp: 0, stress: 0, defeated: false,
      }))
      return { ...e, units: [...e.units, ...units] }
    })
    toast({ text: count > 1 ? `${count} × ${a.name} aggiunti` : `${a.name} aggiunto` })
  }
  async function spendFear(n: number) {
    if (campaign.fear < n) { toast({ text: `Ti servono ${n} Paura, ne hai ${campaign.fear}`, tone: 'error' }); return false }
    await patchCampaign({ fear: campaign.fear - n }).catch(e => toast({ text: e.message, tone: 'error' }))
    return true
  }

  if (error) return <ErrorLine error={error} />
  if (!list || !bestiary) return <div className="center-pad"><Spinner /></div>

  const spent = cur ? battlePointsSpent(cur.units, byId, party) : 0
  const solos = cur ? cur.units.filter(u => byId(u.adv)?.type === 'Solo').length : 0
  const budget = battleBudget(party) + adjust + (solos >= 2 ? -2 : 0)
  const alive = cur?.units.filter(u => !u.defeated).length ?? 0

  return (
    <section className="encounter">
      <div className="enc-head">
        <div className="enc-pick">
          {list.length > 0 ? (
            <select value={cur?.id ?? ''} onChange={e => setCur(list.find(x => x.id === e.target.value) ?? null)} aria-label="Scontro">
              {list.map(e => <option key={e.id} value={e.id}>{e.name || 'Senza nome'}</option>)}
            </select>
          ) : <h2>Scontri</h2>}
          <button className="btn btn-ghost small" onClick={newEncounter}>Nuovo scontro</button>
        </div>
        <div className="enc-fear" aria-label="Paura">
          <span>Paura</span>
          <button className="icon-btn" onClick={() => patchCampaign({ fear: Math.max(0, campaign.fear - 1) })} aria-label="Spendi 1 Paura">−</button>
          <b>{campaign.fear}</b>
          <button className="icon-btn" onClick={() => patchCampaign({ fear: Math.min(12, campaign.fear + 1) })} aria-label="Aggiungi 1 Paura">+</button>
        </div>
      </div>

      {!cur && <p className="empty">Prepara uno scontro: scegli gli avversari dal bestiario dei manuali o crea i tuoi. I giocatori non vedono niente di questa pagina.</p>}

      {cur && (
        <>
          <div className="enc-meta">
            <input className="enc-name" value={cur.name} maxLength={80} onChange={e => update({ ...cur, name: e.target.value })} aria-label="Nome dello scontro" />
            <div className={`bp ${spent > budget ? 'over' : spent === budget ? 'ok' : ''}`}>
              <span>Punti battaglia <b>{spent}</b> su {budget}</span>
              <span className="bp-ctl">PG <Stepper value={party} min={1} max={8} onChange={setParty} /></span>
              <span className="bp-ctl">
                <button className={`chip ${adjust === -1 ? 'sel' : ''}`} onClick={() => setAdjust(a => (a === -1 ? 0 : -1))}>Più facile</button>
                <button className={`chip ${adjust === 2 ? 'sel' : ''}`} onClick={() => setAdjust(a => (a === 2 ? 0 : 2))}>Più difficile</button>
              </span>
            </div>
          </div>

          <div className="enc-actions">
            <button className="btn btn-primary" onClick={() => setAdding(true)}>Aggiungi avversari</button>
            <button className="btn btn-ghost" onClick={() => setEditingAdv(blankAdversary())}>Crea un avversario</button>
            {cur.units.length > 0 && <span className="enc-count">{alive} in piedi su {cur.units.length}</span>}
          </div>

          <div className="units">
            {cur.units.map(u => {
              const a = byId(u.adv)
              if (!a) return <div key={u.uid} className="unit missing">{u.name}: scheda non trovata <button className="link-btn" onClick={() => setUnits(us => us.filter(x => x.uid !== u.uid))}>Togli</button></div>
              return (
                <UnitCard key={u.uid} u={u} a={a}
                  onChange={p => setUnits(us => us.map(x => (x.uid === u.uid ? { ...x, ...p } : x)))}
                  onRemove={() => setUnits(us => us.filter(x => x.uid !== u.uid))}
                  onDefeatMinions={n => setUnits(us => {
                    let left = n
                    return us.map(x => (left > 0 && x.adv === u.adv && x.uid !== u.uid && !x.defeated ? (left--, { ...x, defeated: true, hp: a.hp }) : x))
                  })}
                  onRoll={setOverlay} onFear={spendFear} />
              )
            })}
          </div>

          <div className="enc-foot">
            {cur.units.some(u => u.defeated) && <button className="btn btn-ghost small" onClick={() => setUnits(us => us.filter(u => !u.defeated))}>Togli gli sconfitti</button>}
            <button className="btn btn-ghost small" onClick={() => setUnits(us => us.map(u => ({ ...u, hp: 0, stress: 0, defeated: false })))}>Riporta tutti in forze</button>
            <button className="btn btn-ghost small danger-text" onClick={async () => {
              if (!confirm(`Eliminare «${cur.name}»?`)) return
              await be.deleteEncounter(cur.id).catch(() => {})
              const rest = list.filter(e => e.id !== cur.id); setList(rest); setCur(rest[0] ?? null)
            }}>Elimina scontro</button>
          </div>
        </>
      )}

      {adding && <BestiarySheet all={all} onClose={() => setAdding(false)} onAdd={addUnits}
        onEdit={a => { setAdding(false); setEditingAdv(a.custom ? a : { ...a, id: '', name: `${a.name} (variante)`, custom: true }) }} />}
      {editingAdv && <AdversaryEditor a={editingAdv} onClose={() => setEditingAdv(null)}
        onSaved={a => { setCustom(cs => [...cs.filter(c => c.id !== a.id), a]); setEditingAdv(null); toast({ text: `${a.name} salvato tra i tuoi avversari` }) }}
        onDeleted={id => { setCustom(cs => cs.filter(c => c.id !== id)); setEditingAdv(null) }} />}
      {overlay && <DiceOverlay roll={overlay} onClose={() => setOverlay(null)} />}
    </section>
  )
}

function UnitCard({ u, a, onChange, onRemove, onDefeatMinions, onRoll, onFear }: {
  u: EncounterUnit; a: Adversary; onChange: (p: Partial<EncounterUnit>) => void; onRemove: () => void
  onDefeatMinions: (n: number) => void; onRoll: (r: Roll) => void; onFear: (n: number) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [dmg, setDmg] = useState('')
  const [last, setLast] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingBonus | null>(null)
  // quando cade, la scheda si sbriciola in cenere
  const [ash, setAsh] = useState(0)
  const wasDown = useRef(u.defeated)
  useEffect(() => {
    if (u.defeated && !wasDown.current) { const t = Date.now(); setAsh(t); setTimeout(() => setAsh(a => (a === t ? 0 : a)), 3000) }
    wasDown.current = u.defeated
  }, [u.defeated])
  const minion = a.type === 'Minion'
  const mv = minionValue(a)
  const hordeHalf = a.type === 'Horde' && u.hp >= Math.ceil(a.hp / 2)
  const dmgDice = hordeHalf ? hordeDamage(a) ?? a.damage : a.damage
  const n = parseInt(dmg, 10) || 0
  const marks = adversaryMarks(a, n)

  function applyDamage() {
    if (n <= 0) return
    const hp = Math.min(a.hp, u.hp + marks)
    onChange({ hp, defeated: hp >= a.hp })
    const label = minion ? 'abbattuto' : ['', 'Minore', 'Maggiore', 'Grave', 'Massiccio'][marks]
    let msg = `${n} danni: ${minion ? 'abbattuto' : `${label}, ${marks} PF`}`
    if (minion && mv && Math.floor(n / mv) > 0) msg += `. Abbatte altri ${Math.floor(n / mv)} seguaci`
    setLast(msg)
    if (minion && mv && Math.floor(n / mv) > 0) onDefeatMinions(Math.floor(n / mv))
    setDmg('')
  }

  const pendingDmg = pending && (pending.dmg || pending.dmgFromHp)
    ? [pending.dmg, pending.dmgFromHp ? String(u.hp) : ''].filter(Boolean).join('+') : ''
  const note = (b: PendingBonus) => `, ${bonusText(b, u.hp)} da ${b.src}`

  function rollAttack(label: string, adv = false) {
    const base = typeof a.atk === 'number' ? { groups: [{ n: 1, sides: 20 }], bonus: a.atk } : parseDice(`1d20+${String(a.atk).replace(/^\+/, '')}`)
    const use = pending && (pending.roll || pending.adv) ? pending : null
    const r = localRoll(label + (use ? note({ src: use.src, roll: use.roll, adv: use.adv }) : ''), { ...base, bonus: base.bonus + (use?.roll ?? 0) }, 'dice', undefined, adv || !!use?.adv)
    if (use) setPending(p => p && (p.dmg || p.dmgFromHp) ? { src: p.src, dmg: p.dmg, dmgFromHp: p.dmgFromHp } : null)
    onRoll(r)
  }
  function rollDamage(label: string, formula: string, type: string) {
    const base = parseDice(formula)
    if (pendingDmg && pending) {
      const extra = parseDice(pendingDmg)
      onRoll(localRoll(label + note({ src: pending.src, dmg: pending.dmg, dmgFromHp: pending.dmgFromHp }), { groups: [...base.groups, ...extra.groups], bonus: base.bonus + extra.bonus }, 'damage', type))
      setPending(p => p && (p.roll || p.adv) ? { src: p.src, roll: p.roll, adv: p.adv } : null)
    } else onRoll(localRoll(label, base, 'damage', type))
  }
  async function pay(f: Adversary['features'][number], what: 'fear' | 'stress', n: number) {
    if (what === 'fear') { if (!(await onFear(n))) return }
    else onChange({ stress: u.stress + n })
    const b = featureBonus(f)
    if (b) setPending({ src: f.name, ...b })
  }

  return (
    <article className={`unit t-${a.type.toLowerCase()} ${u.defeated ? 'down' : ''} ${ash ? 'crumbling' : ''} ${!u.defeated && a.hp - u.hp <= Math.max(1, Math.floor(a.hp / 4)) && u.hp > 0 ? 'critical' : ''}`}>
      {ash > 0 && <AshBurst id={`${u.uid}${ash}`} key={ash} />}
      <header className="unit-head">
        <div>
          <input className="unit-name" value={u.name} maxLength={60} onChange={e => onChange({ name: e.target.value })} aria-label="Nome" />
          <p className="unit-sub">{a.type_it}{a.type === 'Horde' && a.horde ? ` (${a.horde}/PF)` : ''}, rango {a.tier}{a.custom ? ', tuo' : ''}</p>
        </div>
        <div className="unit-diff" title="Difficoltà"><small>Diff.</small><b>{a.difficulty}</b></div>
      </header>

      <div className="unit-stats">
        {a.thresholds
          ? <span>Soglie <b>{a.thresholds[0]}</b>/<b>{a.thresholds[1]}</b>/<b>{massiveThreshold(a.thresholds[1])}</b></span>
          : <span>{minion ? 'Cade a qualsiasi danno' : 'Nessuna soglia'}</span>}
        <span>{a.weapon}: {RANGE_IT[a.range] ?? a.range}, {dmgDice} {DMG_IT(a.damage_type)}{hordeHalf ? ' (orda dimezzata)' : ''}</span>
      </div>

      {!minion && <div className="unit-track"><span>PF</span><Pips kind="hp" size="sm" max={a.hp} value={u.hp} onChange={hp => onChange({ hp, defeated: hp >= a.hp })} /></div>}
      {a.stress > 0 && <div className="unit-track"><span>Stress</span><Pips kind="stress" size="sm" max={a.stress} value={u.stress} onChange={stress => onChange({ stress })} /></div>}

      {pending && (
        <p className="pending-bonus">
          <span>Prossimo tiro: <b>{bonusText(pending, u.hp)}</b> da {pending.src}</span>
          <button className="link-btn" onClick={() => setPending(null)} aria-label="Annulla il bonus">Annulla</button>
        </p>
      )}
      <div className="unit-btns">
        <button className="btn btn-ghost small" disabled={u.defeated} onClick={() => rollAttack(`${u.name}: attacco`)}>
          Attacca {fmtAtk(a.atk)}{pending?.roll ? ` +${pending.roll}` : ''}{pending?.adv ? ', vantaggio' : ''}
        </button>
        <button className="btn btn-ghost small btn-dmg" disabled={u.defeated} onClick={() => rollDamage(`${u.name}: ${a.weapon}`, dmgDice, a.damage_type)}>
          Danno {dmgDice}{pendingDmg ? ` +${pendingDmg}` : ''}
        </button>
        <span className="unit-dmg">
          <input type="number" inputMode="numeric" min={0} placeholder="danni" value={dmg} onChange={e => setDmg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyDamage()} aria-label={`Danni subiti da ${u.name}`} />
          <button className="btn btn-ghost small" disabled={n <= 0 || u.defeated} onClick={applyDamage}>
            {n > 0 ? (minion ? 'Abbatti' : `Segna ${marks} PF`) : 'Subisci'}
          </button>
        </span>
      </div>
      {last && <p className="unit-last">{last}</p>}

      <div className="unit-foot">
        <button className="link-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Nascondi capacità' : `Capacità (${a.features.length})`}</button>
        <button className="link-btn" onClick={() => onChange({ defeated: !u.defeated, hp: u.defeated ? Math.min(u.hp, a.hp - 1) : u.hp })}>{u.defeated ? 'Rialza' : 'Sconfitto'}</button>
        <button className="link-btn danger-text" onClick={onRemove}>Togli</button>
      </div>

      {open && (
        <div className="unit-feats">
          {a.experience && <p className="uf-exp"><b>Esperienza:</b> {a.experience}</p>}
          {a.motives && <p className="uf-exp"><b>Motivazioni e tattiche:</b> {a.motives}</p>}
          {a.features.map((f, i) => (
            <div key={i} className={`uf uf-${f.kind}`}>
              <p><b>{f.name}</b> <span className="uf-kind">{KIND_IT[f.kind]}</span></p>
              <p className="uf-text">{f.text}</p>
              {(() => {
                const k = featureCosts(f), b = featureBonus(f), own = featureDamage(f.text)
                const bt = b ? `: ${bonusText(b, u.hp)}` : ''
                if (!k.fear && !k.stress && !own) return null
                return (
                  <div className="uf-btns">
                    {k.fear > 0 && <button className="btn btn-ghost small btn-fear" disabled={u.defeated} onClick={() => pay(f, 'fear', k.fear)}>Spendi {k.fear} Paura{k.stress ? '' : bt}</button>}
                    {k.stress > 0 && <button className="btn btn-ghost small" disabled={u.defeated || u.stress + k.stress > a.stress} onClick={() => pay(f, 'stress', k.stress)}>Segna {k.stress} Stress{bt}</button>}
                    {own && <>
                      <button className="btn btn-ghost small" disabled={u.defeated} onClick={() => rollAttack(`${u.name}: ${f.name}`, /con vantaggio/i.test(f.text))}>Attacca</button>
                      <button className="btn btn-ghost small btn-dmg" disabled={u.defeated} onClick={() => rollDamage(`${u.name}: ${f.name}`, own.dice, own.type)}>Danno {own.dice}</button>
                    </>}
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

function BestiarySheet({ all, onClose, onAdd, onEdit }: { all: Adversary[]; onClose: () => void; onAdd: (a: Adversary, n: number) => void; onEdit: (a: Adversary) => void }) {
  const [q, setQ] = useState('')
  const [tier, setTier] = useState<number | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [count, setCount] = useState(1)
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const shown = all.filter(a => (tier == null || a.tier === tier) && (type == null || a.type === type)
    && (!q || norm(a.name).includes(norm(q)) || norm(a.name_en ?? '').includes(norm(q))))
  return (
    <Sheet open onClose={onClose} title="Bestiario" wide>
      <input className="best-search" type="search" placeholder="Cerca per nome (anche in inglese)" value={q} onChange={e => setQ(e.target.value)} autoFocus />
      <div className="best-filters">
        {[1, 2, 3, 4].map(t => <button key={t} className={`chip ${tier === t ? 'sel' : ''}`} onClick={() => setTier(tier === t ? null : t)}>Rango {t}</button>)}
      </div>
      <div className="best-filters">
        {TYPES.map(t => <button key={t} className={`chip ${type === t ? 'sel' : ''}`} onClick={() => setType(type === t ? null : t)}>{TYPE_IT[t]}</button>)}
      </div>
      <p className="hint">{shown.length} avversari</p>
      <ul className="best-list">
        {shown.slice(0, 120).map(a => (
          <li key={a.id} className={open === a.id ? 'open' : ''}>
            <button className="best-row" onClick={() => { setOpen(open === a.id ? null : a.id); setCount(a.type === 'Minion' ? 4 : 1) }}>
              <span className="br-name">{a.name}{a.custom && <small> tuo</small>}</span>
              <span className="br-meta">{a.type_it}, R{a.tier}</span>
              <span className="br-stats">Diff. {a.difficulty}, {a.hp} PF</span>
            </button>
            {open === a.id && (
              <div className="best-detail">
                {a.desc && <p className="bd-desc">{a.desc}</p>}
                <p className="bd-line">Soglie {a.thresholds ? `${a.thresholds[0]}/${a.thresholds[1]}/${massiveThreshold(a.thresholds[1])}` : 'nessuna'}, PF {a.hp}, Stress {a.stress}, attacco {fmtAtk(a.atk)}, {a.weapon} ({RANGE_IT[a.range] ?? a.range}) {a.damage} {DMG_IT(a.damage_type)}</p>
                {a.experience && <p className="bd-line">Esperienza: {a.experience}</p>}
                <ul className="bd-feats">
                  {a.features.map((f, i) => <li key={i}><b>{f.name}</b> <span className="uf-kind">{KIND_IT[f.kind]}</span>: {f.text}</li>)}
                </ul>
                <div className="bd-add">
                  <Stepper value={count} min={1} max={20} onChange={setCount} />
                  <button className="btn btn-primary small" onClick={() => onAdd(a, count)}>Aggiungi {count > 1 ? `${count}` : ''}</button>
                  <button className="btn btn-ghost small" onClick={() => onEdit(a)}>{a.custom ? 'Modifica' : 'Crea una variante'}</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {shown.length > 120 && <p className="hint">Restringi la ricerca per vedere gli altri.</p>}
    </Sheet>
  )
}

function blankAdversary(): Adversary {
  return {
    id: '', tier: 1, type: 'Standard', type_it: 'Avversario Base', name: '', desc: '', motives: '', difficulty: 12, thresholds: [6, 12],
    hp: 5, stress: 3, atk: 1, weapon: 'Arma', range: 'Melee', damage: '1d8+2', damage_type: 'phy', experience: '', features: [], custom: true,
  }
}

function AdversaryEditor({ a, onClose, onSaved, onDeleted }: { a: Adversary; onClose: () => void; onSaved: (a: Adversary) => void; onDeleted: (id: string) => void }) {
  const { be } = useApp()
  const [v, setV] = useState<Adversary>(a)
  const job = useAsync()
  const set = (p: Partial<Adversary>) => setV(x => ({ ...x, ...p }))
  const setF = (i: number, p: Partial<Adversary['features'][number]>) => set({ features: v.features.map((f, j) => (j === i ? { ...f, ...p } : f)) })
  return (
    <Sheet open onClose={onClose} title={a.id ? 'Modifica avversario' : 'Nuovo avversario'} wide>
      <label className="field"><span>Nome</span><input value={v.name} maxLength={80} onChange={e => set({ name: e.target.value })} /></label>
      <div className="best-filters">
        {TYPES.map(t => <button key={t} type="button" className={`chip ${v.type === t ? 'sel' : ''}`} onClick={() => set({ type: t, type_it: TYPE_IT[t] })}>{TYPE_IT[t]}</button>)}
      </div>
      <div className="edit-grid">
        <div className="edit-row"><span>Rango</span><Stepper value={v.tier} min={1} max={4} onChange={tier => set({ tier })} /></div>
        <div className="edit-row"><span>Difficoltà</span><Stepper value={v.difficulty} min={1} max={40} onChange={difficulty => set({ difficulty })} /></div>
        {v.type !== 'Minion' && <>
          <div className="edit-row"><span>Soglia Maggiore</span><Stepper value={v.thresholds?.[0] ?? 6} min={1} max={80} onChange={n => set({ thresholds: [n, Math.max(n + 1, v.thresholds?.[1] ?? 12)] })} /></div>
          <div className="edit-row"><span>Soglia Grave</span><Stepper value={v.thresholds?.[1] ?? 12} min={2} max={160} onChange={n => set({ thresholds: [Math.min(v.thresholds?.[0] ?? 6, n - 1), n] })} /></div>
        </>}
        <div className="edit-row"><span>PF</span><Stepper value={v.hp} min={1} max={30} onChange={hp => set({ hp })} /></div>
        <div className="edit-row"><span>Stress</span><Stepper value={v.stress} min={0} max={20} onChange={stress => set({ stress })} /></div>
        <div className="edit-row"><span>Attacco</span><Stepper value={typeof v.atk === 'number' ? v.atk : 0} min={-5} max={20} onChange={atk => set({ atk })} /></div>
      </div>
      <div className="row-gap">
        <label className="field grow"><span>Arma</span><input value={v.weapon} onChange={e => set({ weapon: e.target.value })} /></label>
        <label className="field"><span>Danno</span><input value={v.damage} placeholder="1d8+2" onChange={e => set({ damage: e.target.value })} /></label>
      </div>
      <div className="seg">
        {Object.entries(RANGE_IT).map(([k, l]) => <button key={k} type="button" className={v.range === k ? 'sel' : ''} onClick={() => set({ range: k })}>{l}</button>)}
      </div>
      <div className="seg">
        <button type="button" className={v.damage_type !== 'mag' ? 'sel' : ''} onClick={() => set({ damage_type: 'phy' })}>Fisico</button>
        <button type="button" className={v.damage_type === 'mag' ? 'sel' : ''} onClick={() => set({ damage_type: 'mag' })}>Magico</button>
      </div>
      <label className="field"><span>Esperienza</span><input value={v.experience} placeholder="Imboscata +2" onChange={e => set({ experience: e.target.value })} /></label>
      <label className="field"><span>Descrizione</span><textarea rows={2} value={v.desc} onChange={e => set({ desc: e.target.value })} /></label>
      <label className="field"><span>Motivazioni e tattiche</span><input value={v.motives} onChange={e => set({ motives: e.target.value })} /></label>
      <p className="field-title">Capacità</p>
      {v.features.map((f, i) => (
        <div key={i} className="feat-edit">
          <div className="row-gap">
            <input className="grow" value={f.name} placeholder="Nome" onChange={e => setF(i, { name: e.target.value })} />
            <select value={f.kind} onChange={e => setF(i, { kind: e.target.value as 'passive' })}>
              <option value="passive">Passiva</option><option value="action">Azione</option><option value="reaction">Reazione</option>
            </select>
            <button className="link-btn danger-text" onClick={() => set({ features: v.features.filter((_, j) => j !== i) })}>Togli</button>
          </div>
          <textarea rows={3} value={f.text} onChange={e => setF(i, { text: e.target.value })} />
          <div className="row-gap">
            <span className="hint">Costo:</span>
            <span className="bp-ctl">Paura <Stepper value={f.fear ?? 0} min={0} max={6} onChange={n => setF(i, { fear: n || undefined })} /></span>
            <span className="bp-ctl">Stress <Stepper value={f.stress ?? 0} min={0} max={6} onChange={n => setF(i, { stress: n || undefined })} /></span>
          </div>
          <div className="row-gap">
            <span className="hint">Bonus al prossimo tiro:</span>
            <span className="bp-ctl">Attacco <Stepper value={f.bonus_roll ?? 0} min={0} max={10} onChange={n => setF(i, { bonus_roll: n || undefined })} /></span>
            <label className="bp-ctl">Danno <input className="short" value={f.bonus_dmg ?? ''} placeholder="+4 o 1d6" maxLength={12} onChange={e => setF(i, { bonus_dmg: e.target.value.trim() || undefined })} /></label>
          </div>
        </div>
      ))}
      <button className="btn btn-ghost small" onClick={() => set({ features: [...v.features, { name: '', kind: 'action', text: '' }] })}>+ Capacità</button>
      <ErrorLine error={job.error} />
      <div className="row-gap end">
        {a.id && <button className="btn btn-ghost danger-text" disabled={job.busy} onClick={async () => {
          if (confirm(`Eliminare «${a.name}» dai tuoi avversari?`) && await job.run(() => be.deleteCustomAdversary(a.id).then(() => true))) onDeleted(a.id)
        }}>Elimina</button>}
        <button className="btn btn-primary" disabled={job.busy || !v.name.trim()} onClick={async () => {
          const saved = await job.run(() => be.saveCustomAdversary({ ...v, name: v.name.trim(), thresholds: v.type === 'Minion' ? null : v.thresholds, custom: true }))
          if (saved) onSaved(saved)
        }}>Salva</button>
      </div>
    </Sheet>
  )
}
