import { useState } from 'react'
import { StressButtons } from './StressUse'
import type { StressUse } from '../lib/costs'
import type { CardAction } from '../lib/cardEffects'
import { CardActionButtons } from './CardPlay'
import { guess, hbAbilityKey, hbActions, splitAbilities } from '../lib/hbAbilities'
import type { Character, HbAbility, HbMode, Homebrew, HomebrewKind, SheetData, TraitKey } from '../lib/types'
import { TRAITS } from '../lib/types'
import { IT } from '../data'
import { armorScore, fmt, HB, weaponDamage } from '../lib/rules'
import { ErrorLine, Pips, Sheet, Stepper } from './ui'

export const KIND_LABEL: Record<HomebrewKind, string> = { weapon: 'Arma', armor: 'Armatura', ability: 'Capacità', item: 'Oggetto' }
const RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'] as const
const newId = () => Math.random().toString(36).slice(2, 10)

function blank(kind: HomebrewKind): Homebrew {
  const base: Homebrew = { id: newId(), kind, name: '', text: '' }
  if (kind === 'weapon') return { ...base, trait: 'strength', range: 'Melee', dice: 'd8', damageType: 'phy', burden: 'One-Handed', category: 'primary' }
  if (kind === 'armor') return { ...base, thresholds: [5, 11], score: 3 }
  if (kind === 'item') return { ...base, quantity: 1, uses: 0, used: 0, mods: {} }
  return { ...base, uses: 0, used: 0, mods: {} }
}

/** Riepilogo compatto delle statistiche di un elemento homebrew. */
export function homebrewStats(h: Homebrew, proficiency = 1) {
  const m = h.mods ?? {}
  const modParts = [m.evasion ? `Evasione ${fmt(m.evasion)}` : '', m.armor ? `Armatura ${fmt(m.armor)}` : '', m.thresholds ? `Soglie ${fmt(m.thresholds)}` : '',
    ...Object.entries(m.traits ?? {}).filter(([, v]) => v).map(([t, v]) => `${IT.traits[t as TraitKey]} ${fmt(v!)}`)].filter(Boolean)
  if (h.kind === 'weapon') {
    return [`${IT.traits[h.trait ?? 'strength']}, ${IT.range[h.range ?? 'Melee']}, ${weaponDamage(`${h.dice || 'd6'} ${h.damageType ?? 'phy'}`, proficiency)}, ${IT.burden[h.burden ?? 'One-Handed']}, ${h.category === 'secondary' ? 'secondaria' : 'primaria'}`, ...((h.modes ?? (h.alt ? [h.alt] : [])).length ? [`altri modi: ${(h.modes ?? [h.alt!]).map(m => m.name).join(', ')}`] : []), ...modParts].join(', ')
  }
  if (h.kind === 'armor') return [`Soglie base ${h.thresholds?.[0]}/${h.thresholds?.[1]}, punteggio ${h.score}`, ...modParts].join(', ')
  const parts = [...modParts]
  if (h.kind === 'item' && (h.quantity ?? 1) !== 1) parts.unshift(`× ${h.quantity}`)
  return parts.filter(Boolean).join(', ')
}

/** Elenco dell'homebrew del PG con creazione, modifica ed eliminazione. */
type PlayFn = (card: { id: string; name: string }, a: CardAction) => void

/** Abilità di un elemento homebrew: titolo, testo e pulsanti. */
export function HbAbilities({ h, c, canEdit, onStress, onPlayCard, onCardTokens, compact }: {
  h: Homebrew; c: Character; canEdit: boolean; onStress?: (u: StressUse, src: string) => void
  onPlayCard?: PlayFn; onCardTokens?: (id: string, n: number) => void; compact?: boolean
}) {
  return (
    <div className="hb-abilities">
      {(h.abilities ?? []).map(a => (
        <div key={a.id} className="hb-ab">
          <b className="hb-ab-name">{a.name}</b>
          {!compact && a.text && <p className="hb-text">{a.text}</p>}
          {hbActions(a).length > 0
            ? <CardActionButtons cardId={hbAbilityKey(h, a)} cardName={`${h.name}: ${a.name}`} c={c} canEdit={canEdit} onPlay={onPlayCard} onTokens={onCardTokens} />
            : a.text && <StressButtons text={a.text} src={`${h.name}: ${a.name}`} c={c} canEdit={canEdit} onUse={onStress} />}
        </div>
      ))}
    </div>
  )
}

export function HomebrewSection({ c, canEdit, patch, onStress, onPlayCard, onCardTokens }: { c: Character; canEdit: boolean; patch: (p: Partial<Character>) => void; onStress?: (u: StressUse, src: string) => void; onPlayCard?: PlayFn; onCardTokens?: (id: string, n: number) => void }) {
  const d = c.data
  const list = d.homebrew ?? []
  const [editing, setEditing] = useState<Homebrew | null>(null)

  function save(next: Homebrew[], extra: Partial<SheetData> = {}) {
    const nd = { ...d, ...extra, homebrew: next }
    const max = armorScore(nd)
    patch({ data: nd, armor_max: max, armor_marked: Math.min(c.armor_marked, max) })
  }
  function upsert(h: Homebrew) {
    const exists = list.some(x => x.id === h.id)
    save(exists ? list.map(x => (x.id === h.id ? h : x)) : [...list, h])
    setEditing(null)
  }
  function remove(h: Homebrew) {
    const id = HB + h.id
    // se era equipaggiato, lo tolgo dagli slot
    const extra: Partial<SheetData> = {}
    if (d.primary_weapon_id === id) extra.primary_weapon_id = ''
    if (d.secondary_weapon_id === id) extra.secondary_weapon_id = ''
    if (d.armor_id === id) extra.armor_id = ''
    save(list.filter(x => x.id !== h.id), extra)
    setEditing(null)
  }
  function setUsed(h: Homebrew, n: number) { save(list.map(x => (x.id === h.id ? { ...x, used: n } : x))) }
  function equip(h: Homebrew) {
    const id = HB + h.id
    if (h.kind === 'armor') return save(list, { armor_id: d.armor_id === id ? '' : id })
    if (h.category === 'secondary') return save(list, { secondary_weapon_id: d.secondary_weapon_id === id ? '' : id })
    const twoHanded = h.burden === 'Two-Handed'
    save(list, { primary_weapon_id: d.primary_weapon_id === id ? '' : id, ...(twoHanded ? { secondary_weapon_id: '' } : {}) })
  }
  const equipped = (h: Homebrew) => [d.primary_weapon_id, d.secondary_weapon_id, d.armor_id].includes(HB + h.id)

  return (
    <section>
      <div className="section-head">
        <h2>Homebrew</h2>
        {canEdit && (
          <div className="hb-add">
            {(['ability', 'item', 'weapon', 'armor'] as HomebrewKind[]).map(k => (
              <button key={k} className="btn btn-ghost small" onClick={() => setEditing(blank(k))}>+ {KIND_LABEL[k]}</button>
            ))}
          </div>
        )}
      </div>
      {list.length === 0 && <p className="empty">Armi, armature, capacità e oggetti inventati da voi compaiono qui.</p>}
      <div className="hb-list">
        {list.map(h => (
          <article key={h.id} className={`hb-item kind-${h.kind}`}>
            <header>
              <span className="hb-kind">{KIND_LABEL[h.kind]}</span>
              <b className="hb-name">{h.name}</b>
              {canEdit && <button className="btn btn-ghost small" onClick={() => setEditing(h)}>Modifica</button>}
            </header>
            {homebrewStats(h, d.proficiency) && <p className="hb-stats">{homebrewStats(h, d.proficiency)}</p>}
            {h.abilities?.length
              ? <HbAbilities h={h} c={c} canEdit={canEdit} onStress={onStress} onPlayCard={onPlayCard} onCardTokens={onCardTokens} />
              : <>
                {h.text && <p className="hb-text">{h.text}</p>}
                {h.text && <StressButtons text={h.text} src={h.name} c={c} canEdit={canEdit} onUse={onStress} />}
                {canEdit && h.text && splitAbilities(h.text).length > 1 && (
                  <button className="btn btn-ghost small" onClick={() => save(list.map(x => (x.id === h.id ? { ...x, abilities: splitAbilities(h.text) } : x)))}>
                    Dividi in {splitAbilities(h.text).length} abilità giocabili
                  </button>
                )}
              </>}
            {(h.uses ?? 0) > 0 && (
              <div className="hb-uses"><span>Usi</span>
                <Pips kind="stress" size="sm" max={h.uses!} value={h.used ?? 0} label={`Usi di ${h.name}`} onChange={canEdit ? n => setUsed(h, n) : undefined} />
              </div>
            )}
            {canEdit && (h.kind === 'weapon' || h.kind === 'armor') && (
              <button className={`btn small ${equipped(h) ? 'btn-hope' : 'btn-ghost'}`} onClick={() => equip(h)}>
                {equipped(h) ? 'Equipaggiato, togli' : 'Equipaggia'}
              </button>
            )}
          </article>
        ))}
      </div>
      {editing && <HomebrewEditor item={editing} onClose={() => setEditing(null)} onSave={upsert}
        onDelete={list.some(x => x.id === editing.id) ? () => remove(editing) : undefined} />}
    </section>
  )
}

function HomebrewEditor({ item, onClose, onSave, onDelete }: { item: Homebrew; onClose: () => void; onSave: (h: Homebrew) => void; onDelete?: () => void }) {
  // il vecchio secondo modo passa nella lista dei modi
  const [h, setH] = useState<Homebrew>(() => (item.alt && !item.modes ? { ...item, modes: [item.alt], alt: undefined } : item))
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const set = (p: Partial<Homebrew>) => setH(x => ({ ...x, ...p }))
  const setMod = (k: 'evasion' | 'armor' | 'thresholds', n: number) => set({ mods: { ...(h.mods ?? {}), [k]: n } })

  function submit() {
    if (!h.name.trim()) return setErr('Dai un nome.')
    if (h.kind === 'weapon' && !/^\d*d\d+(\s*[+-]\s*\d+)?$/i.test((h.dice ?? '').replace(/\s/g, ''))) return setErr('Il danno va scritto come d8, d10+3, 2d6+1…')
    const DICE = /^\d*d\d+(\s*[+-]\s*\d+)?$/i
    for (const m of h.modes ?? []) {
      if (m.dice && !DICE.test(m.dice.replace(/\s/g, ''))) return setErr(`Il danno di «${m.name || 'altro modo'}» va scritto come d8, d10+3…`)
      if (m.extra && !DICE.test(m.extra.replace(/[\s+]/g, '')) && !/^\+?\d+$/.test(m.extra.trim())) return setErr(`I danni in più di «${m.name || 'altro modo'}» vanno scritti come 1d6 o 3`)
    }
    const abilities = h.abilities?.filter(a => a.name.trim() || a.text.trim())
    // con le abilità il testo dell'elemento è la loro somma (per anteprime e ricerca)
    const text = abilities?.length ? abilities.map(a => `${a.name.toUpperCase()}\n${a.text}`).join('\n\n') : h.text.trim()
    onSave({ ...h, abilities: abilities?.length ? abilities : undefined, name: h.name.trim(), text, dice: h.dice?.replace(/\s/g, '').toLowerCase() })
  }

  return (
    <Sheet open onClose={onClose} title={`${onDelete ? 'Modifica' : 'Nuova'} ${KIND_LABEL[h.kind].toLowerCase()}`}>
      <label className="field"><span>Nome</span><input value={h.name} maxLength={60} onChange={e => set({ name: e.target.value })} autoFocus /></label>

      {h.kind === 'weapon' && (
        <>
          <div className="two-col">
            <label className="field"><span>Tratto</span>
              <select value={h.trait} onChange={e => set({ trait: e.target.value as TraitKey })}>
                {TRAITS.map(t => <option key={t} value={t}>{IT.traits[t]}</option>)}
              </select>
            </label>
            <label className="field"><span>Portata</span>
              <select value={h.range} onChange={e => set({ range: e.target.value as Homebrew['range'] })}>
                {RANGES.map(r => <option key={r} value={r}>{IT.range[r]}</option>)}
              </select>
            </label>
            <label className="field"><span>Dado di danno</span>
              <input value={h.dice} onChange={e => set({ dice: e.target.value })} placeholder="d8+2" />
            </label>
            <label className="field"><span>Tipo di danno</span>
              <select value={h.damageType} onChange={e => set({ damageType: e.target.value as 'phy' | 'mag' })}>
                <option value="phy">Fisico</option><option value="mag">Magico</option>
              </select>
            </label>
          </div>
          <div className="seg">
            <button type="button" className={h.category !== 'secondary' ? 'sel' : ''} onClick={() => set({ category: 'primary' })}>Primaria</button>
            <button type="button" className={h.category === 'secondary' ? 'sel' : ''} onClick={() => set({ category: 'secondary', burden: 'One-Handed' })}>Secondaria</button>
          </div>
          <div className="seg">
            <button type="button" className={h.burden !== 'Two-Handed' ? 'sel' : ''} onClick={() => set({ burden: 'One-Handed' })}>Una mano</button>
            <button type="button" className={h.burden === 'Two-Handed' ? 'sel' : ''} disabled={h.category === 'secondary'} onClick={() => set({ burden: 'Two-Handed' })}>Due mani</button>
          </div>
          <p className="hint">Il danno si moltiplica per la Competenza come le armi del manuale.</p>
          <ModesEditor h={h} set={set} />
        </>
      )}

      {h.kind === 'armor' && (
        <div className="edit-grid">
          <div className="edit-row"><span>Soglia Maggiore base</span><Stepper value={h.thresholds?.[0] ?? 5} min={1} max={40} onChange={n => set({ thresholds: [n, Math.max(n + 1, h.thresholds?.[1] ?? 11)] })} /></div>
          <div className="edit-row"><span>Soglia Grave base</span><Stepper value={h.thresholds?.[1] ?? 11} min={2} max={80} onChange={n => set({ thresholds: [Math.min(h.thresholds?.[0] ?? 5, n - 1), n] })} /></div>
          <div className="edit-row"><span>Punteggio Armatura</span><Stepper value={h.score ?? 3} min={0} max={12} onChange={n => set({ score: n })} /></div>
        </div>
      )}

      {(h.kind === 'weapon' || h.kind === 'armor') && (
        <>
          <p className="field-title">Bonus e penalità <small>(valgono solo quando è equipaggiata)</small></p>
          <div className="edit-grid">
            <div className="edit-row"><span>Evasione</span><Stepper value={h.mods?.evasion ?? 0} min={-5} max={10} onChange={n => setMod('evasion', n)} /></div>
            {h.kind === 'weapon' && <div className="edit-row"><span>Punteggio Armatura</span><Stepper value={h.mods?.armor ?? 0} min={-5} max={10} onChange={n => setMod('armor', n)} /></div>}
            <div className="edit-row"><span>Soglie di danno</span><Stepper value={h.mods?.thresholds ?? 0} min={-10} max={20} onChange={n => setMod('thresholds', n)} /></div>
          </div>
          <TraitMods h={h} set={set} />
        </>
      )}

      {(h.kind === 'ability' || h.kind === 'item') && (
        <>
          {h.kind === 'item' && <div className="edit-row"><span>Quantità</span><Stepper value={h.quantity ?? 1} min={0} max={99} onChange={n => set({ quantity: n })} /></div>}
          <p className="field-title">Bonus fissi <small>(si applicano da soli alla scheda)</small></p>
          <div className="edit-grid">
            <div className="edit-row"><span>Evasione</span><Stepper value={h.mods?.evasion ?? 0} min={-5} max={10} onChange={n => setMod('evasion', n)} /></div>
            <div className="edit-row"><span>Punteggio Armatura</span><Stepper value={h.mods?.armor ?? 0} min={-5} max={10} onChange={n => setMod('armor', n)} /></div>
            <div className="edit-row"><span>Soglie di danno</span><Stepper value={h.mods?.thresholds ?? 0} min={-10} max={20} onChange={n => setMod('thresholds', n)} /></div>
            <div className="edit-row"><span>Caselle d'uso</span><Stepper value={h.uses ?? 0} min={0} max={12} onChange={n => set({ uses: n, used: Math.min(h.used ?? 0, n) })} /></div>
          </div>
          <TraitMods h={h} set={set} />
        </>
      )}

      <AbilitiesEditor h={h} set={set} />
      {!h.abilities?.length && <label className="field"><span>{h.kind === 'weapon' || h.kind === 'armor' ? 'Caratteristica (facoltativa)' : 'Descrizione e regole'}</span>
        <textarea rows={4} value={h.text} onChange={e => set({ text: e.target.value })}
          placeholder={h.kind === 'ability' ? 'Una volta per riposo, potete spendere una Speranza per…' : h.kind === 'item' ? 'Cosa fa e da dove viene' : 'Es. Affilata: +1 ai tiri di danno'} />
      </label>}

      <ErrorLine error={err} />
      <button className="btn btn-primary" onClick={submit}>Salva</button>
      {onDelete && (!confirmDel
        ? <button className="btn btn-danger" onClick={() => setConfirmDel(true)}>Elimina</button>
        : <button className="btn btn-danger" onClick={onDelete}>Conferma: elimina {h.name}</button>)}
    </Sheet>
  )
}

/** Bonus o penalità ai tratti (es. armatura pesante: −1 Agilità). */
function TraitMods({ h, set }: { h: Homebrew; set: (p: Partial<Homebrew>) => void }) {
  const tr = h.mods?.traits ?? {}
  const any = Object.values(tr).some(v => v)
  const [open, setOpen] = useState(any)
  const setT = (t: TraitKey, n: number) => set({ mods: { ...(h.mods ?? {}), traits: { ...tr, [t]: n } } })
  return (
    <details className="trait-mods" open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Bonus ai tratti{any ? `: ${Object.entries(tr).filter(([, v]) => v).map(([t, v]) => `${IT.traits[t as TraitKey]} ${fmt(v!)}`).join(', ')}` : ''}</summary>
      <div className="edit-grid">
        {TRAITS.map(t => (
          <div key={t} className="edit-row"><span>{IT.traits[t]}</span><Stepper value={tr[t] ?? 0} min={-5} max={5} onChange={n => setT(t, n)} /></div>
        ))}
      </div>
    </details>
  )
}

/** Abilità separate dell'elemento: nome, testo, costo e bonus. */
function AbilitiesEditor({ h, set }: { h: Homebrew; set: (p: Partial<Homebrew>) => void }) {
  const list = h.abilities ?? []
  const upd = (id: string, p: Partial<HbAbility>) => set({ abilities: list.map(a => (a.id === id ? { ...a, ...p } : a)) })
  const add = () => set({ abilities: [...list, { id: Math.random().toString(36).slice(2, 8), name: '', text: '' }] })
  return (
    <div className="ab-editor">
      <div className="section-head">
        <p className="field-title">Abilità <small>(ognuna con i suoi pulsanti)</small></p>
        <span className="hb-add">
          {!list.length && h.text.trim() && <button type="button" className="btn btn-ghost small" onClick={() => set({ abilities: splitAbilities(h.text) })}>Dividi il testo</button>}
          <button type="button" className="btn btn-ghost small" onClick={add}>+ Abilità</button>
        </span>
      </div>
      {list.map(a => (
        <div key={a.id} className="ab-edit">
          <div className="ab-edit-head">
            <input value={a.name} placeholder="Nome dell’abilità" maxLength={50} onChange={e => upd(a.id, { name: e.target.value })} />
            <button type="button" className="link-btn" onClick={() => set({ abilities: list.filter(x => x.id !== a.id) })}>Togli</button>
          </div>
          <textarea rows={3} value={a.text} placeholder="Cosa fa" onChange={e => upd(a.id, { text: e.target.value })} />
          <div className="edit-grid">
            <div className="edit-row"><span>Costo Speranza</span><Stepper value={a.hope ?? 0} min={0} max={5} onChange={n => upd(a.id, { hope: n || undefined })} /></div>
            <div className="edit-row"><span>Costo Stress</span><Stepper value={a.stress ?? 0} min={0} max={5} onChange={n => upd(a.id, { stress: n || undefined })} /></div>
            <div className="edit-row"><span>Bonus al prossimo tiro</span><Stepper value={a.bonusRoll ?? 0} min={0} max={10} onChange={n => upd(a.id, { bonusRoll: n || undefined })} /></div>
            <label className="edit-row"><span>Danni in più</span><input className="short" value={a.bonusDmg ?? ''} placeholder="1d6 o 3" maxLength={12} onChange={e => upd(a.id, { bonusDmg: e.target.value.trim() || undefined })} /></label>
            <label className="edit-row"><span>Dadi da tirare</span><input className="short" value={a.dice ?? ''} placeholder="1d8" maxLength={12} onChange={e => upd(a.id, { dice: e.target.value.trim() || undefined })} /></label>
            <label className="edit-row"><span>Limite</span>
              <select value={a.per ?? ''} onChange={e => upd(a.id, { per: (e.target.value || undefined) as HbAbility['per'] })}>
                <option value="">Nessuno</option><option value="rest">Una volta per riposo</option><option value="longRest">Una volta per riposo lungo</option>
              </select>
            </label>
          </div>
          <label className="toggle"><input type="checkbox" checked={!!a.adv} onChange={e => upd(a.id, { adv: e.target.checked || undefined })} /> Dà vantaggio al prossimo tiro</label>
          {a.text && <button type="button" className="link-btn" onClick={() => upd(a.id, guess({ ...a, hope: undefined, stress: undefined, bonusRoll: undefined, bonusDmg: undefined, adv: undefined, per: undefined }))}>Proponi costi e bonus dal testo</button>}
        </div>
      ))}
    </div>
  )
}

/** Altri modi d'uso dell'arma (fino a 2 oltre al principale), ognuno con portata, danno e costo. */
function ModesEditor({ h, set }: { h: Homebrew; set: (p: Partial<Homebrew>) => void }) {
  const list = h.modes ?? []
  const upd = (i: number, p: Partial<HbMode>) => set({ modes: list.map((m, j) => (j === i ? { ...m, ...p } : m)) })
  return (
    <div className="ab-editor">
      <div className="section-head">
        <p className="field-title">Altri modi d’uso <small>({list.length}/2)</small></p>
        {list.length < 2 && <button type="button" className="btn btn-ghost small" onClick={() => set({ modes: [...list, { name: list.length ? 'Terzo modo' : 'Lanciata', range: 'Close' }] })}>+ Modo d’uso</button>}
      </div>
      {list.map((m, i) => (
        <div key={i} className="ab-edit">
          <div className="ab-edit-head">
            <input value={m.name} maxLength={30} placeholder="Nome (es. Pistola)" onChange={e => upd(i, { name: e.target.value })} />
            <button type="button" className="link-btn" onClick={() => set({ modes: list.filter((_, j) => j !== i) })}>Togli</button>
          </div>
          <div className="two-col">
            <label className="field"><span>Tratto</span>
              <select value={m.trait ?? h.trait} onChange={e => upd(i, { trait: e.target.value as TraitKey })}>
                {TRAITS.map(t => <option key={t} value={t}>{IT.traits[t]}</option>)}
              </select>
            </label>
            <label className="field"><span>Portata</span>
              <select value={m.range ?? h.range} onChange={e => upd(i, { range: e.target.value as Homebrew['range'] })}>
                {RANGES.map(r => <option key={r} value={r}>{IT.range[r]}</option>)}
              </select>
            </label>
            <label className="field"><span>Dado di danno</span>
              <input value={m.dice ?? ''} placeholder={h.dice || 'd8'} onChange={e => upd(i, { dice: e.target.value || undefined })} />
            </label>
            <label className="field"><span>Tipo di danno</span>
              <select value={m.damageType ?? h.damageType} onChange={e => upd(i, { damageType: e.target.value as 'phy' | 'mag' })}>
                <option value="phy">Fisico</option><option value="mag">Magico</option>
              </select>
            </label>
          </div>
          <div className="edit-grid">
            <label className="edit-row"><span>Danni in più</span><input className="short" value={m.extra ?? ''} placeholder="1d6 o 3" maxLength={12} onChange={e => upd(i, { extra: e.target.value.trim() || undefined })} /></label>
            <div className="edit-row"><span>Costo Stress</span><Stepper value={m.stress ?? 0} min={0} max={5} onChange={n => upd(i, { stress: n || undefined })} /></div>
            <div className="edit-row"><span>Costo Speranza</span><Stepper value={m.hope ?? 0} min={0} max={5} onChange={n => upd(i, { hope: n || undefined })} /></div>
          </div>
          <p className="hint">Campi vuoti: valgono come il modo principale. Il costo si paga quando tiri l’attacco in questo modo.</p>
        </div>
      ))}
    </div>
  )
}
