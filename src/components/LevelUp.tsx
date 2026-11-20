import { useMemo, useState } from 'react'
import type { Character, SheetData, TraitKey } from '../lib/types'
import { TRAITS } from '../lib/types'
import { CARDS, CLASSES, className, domainName, getClass, IT } from '../data'
import { ADVANCEMENTS, fmt, MAX_LOADOUT, tierOf } from '../lib/rules'
import { DomainCardView } from './CardView'
import { ErrorLine, Sheet } from './ui'

export function LevelUpSheet({ open, onClose, c, patch }: { open: boolean; onClose: () => void; c: Character; patch: (p: Partial<Character>) => void }) {
  const d = c.data
  const L = c.level + 1
  const T = tierOf(L)
  const achievement = L === 2 || L === 5 || L === 8
  const cls = getClass(d.class_id)!

  const [picks, setPicks] = useState<string[]>([])
  const [newExp, setNewExp] = useState('')
  const [traitUps, setTraitUps] = useState<TraitKey[]>([])
  const [expUps, setExpUps] = useState<number[]>([])
  const [cards, setCards] = useState<string[]>([])
  const [mc, setMc] = useState<{ class_id: string; domain: string; subclass_id: string }>({ class_id: '', domain: '', subclass_id: '' })
  const [err, setErr] = useState<string | null>(null)

  const markedNow = achievement && L !== 2 ? [] : d.marked_traits ?? []
  const usedThisTier = (id: string) => d.advancements.filter(a => tierOf(a.level) === T).flatMap(a => a.picks).filter(p => p === id).length
  const points = picks.reduce((s, id) => s + (ADVANCEMENTS.find(a => a.id === id)?.cost ?? 1), 0)
  const multiTaken = !!d.multiclass || d.advancements.some(a => a.picks.includes('multiclass'))
  const subTakenThisTier = usedThisTier('subclass') > 0 || picks.includes('subclass')

  function available(id: string) {
    const a = ADVANCEMENTS.find(x => x.id === id)!
    if (a.minTier > T) return false
    if (usedThisTier(id) + picks.filter(p => p === id).length >= a.slots) return false
    if (points + a.cost > 2) return false
    if (id === 'subclass' && (d.subclass_tier === 'mastery' || picks.includes('multiclass') || usedThisTier('multiclass') > 0)) return false
    if (id === 'multiclass' && (multiTaken || subTakenThisTier)) return false
    return true
  }

  const cardsNeeded = 1 + picks.filter(p => p === 'card').length
  const owned = new Set([...d.loadout, ...d.vault])
  const domains = [...cls.domains, ...(d.multiclass?.domain ? [d.multiclass.domain] : [])]
  const pool = useMemo(() => CARDS.filter(x => domains.includes(x.domain) && x.level <= (cls.domains.includes(x.domain) ? L : Math.ceil(L / 2)) && !owned.has(x.id)).sort((a, b) => b.level - a.level), [L])
  const [dom, setDom] = useState(domains[0])

  function confirm() {
    setErr(null)
    if (points !== 2) return setErr('Scegli avanzamenti per un totale di 2.')
    if (achievement && !newExp.trim()) return setErr('Dai un nome alla nuova Esperienza.')
    if (picks.includes('traits') && traitUps.length !== 2 * picks.filter(p => p === 'traits').length) return setErr('Scegli i tratti da aumentare.')
    if (picks.includes('experience') && expUps.length !== 2) return setErr('Scegli due Esperienze da aumentare.')
    if (cards.length !== cardsNeeded) return setErr(`Scegli ${cardsNeeded === 1 ? 'la nuova carta dominio' : `${cardsNeeded} carte dominio`}.`)
    if (picks.includes('multiclass') && !(mc.class_id && mc.domain && mc.subclass_id)) return setErr('Completa le scelte del multiclasse.')

    const nd: SheetData = structuredClone(d)
    let hp = c.hp_max, stress = c.stress_max
    if (achievement) {
      nd.experiences = [...nd.experiences, { name: newExp.trim(), bonus: 2 }]
      nd.proficiency += 1
      if (L === 5 || L === 8) nd.marked_traits = []
    }
    for (const p of picks) {
      if (p === 'hp') hp = Math.min(12, hp + 1)
      if (p === 'stress') stress = Math.min(12, stress + 1)
      if (p === 'evasion') nd.evasion_bonus += 1
      if (p === 'proficiency') nd.proficiency += 1
      if (p === 'subclass') nd.subclass_tier = nd.subclass_tier === 'foundation' ? 'specialization' : 'mastery'
    }
    for (const t of traitUps) { nd.traits[t] += 1; nd.marked_traits = [...nd.marked_traits, t] }
    for (const i of expUps) nd.experiences[i] = { ...nd.experiences[i], bonus: nd.experiences[i].bonus + 1 }
    if (picks.includes('multiclass')) nd.multiclass = mc
    for (const id of cards) {
      if (nd.loadout.length < MAX_LOADOUT) nd.loadout.push(id); else nd.vault.push(id)
    }
    nd.advancements = [...nd.advancements, { level: L, picks }]
    patch({ level: L, hp_max: hp, stress_max: stress, data: nd })
    onClose()
  }

  const toggle = <T,>(arr: T[], v: T, max: number) => (arr.includes(v) ? arr.filter(x => x !== v) : arr.length < max ? [...arr, v] : arr)
  const unmarked = TRAITS.filter(t => !markedNow.includes(t))
  const mcClass = getClass(mc.class_id)

  return (
    <Sheet open={open} onClose={onClose} title={`Livello ${L}`} wide>
      {achievement && (
        <div className="panel detail">
          <h3>Traguardo di rango {T}</h3>
          <p>+1 Competenza e una nuova Esperienza a +2{L !== 2 ? '. I tratti marcati tornano disponibili.' : '.'}</p>
          <label className="field"><span>Nuova Esperienza</span><input value={newExp} onChange={e => setNewExp(e.target.value)} /></label>
        </div>
      )}

      <p className="field-title">Avanzamenti <small>({points}/2)</small></p>
      <div className="move-list">
        {ADVANCEMENTS.filter(a => a.minTier <= T).map(a => {
          const count = picks.filter(p => p === a.id).length
          return (
            <div key={a.id} className={`adv-row ${count ? 'sel' : ''}`}>
              <span>{a.label}</span>
              <span className="adv-btns">
                {count > 0 && <button type="button" className="btn btn-ghost small" onClick={() => { const i = picks.indexOf(a.id); setPicks(picks.filter((_, j) => j !== i)) }}>−</button>}
                {count > 0 && <b>{count}</b>}
                <button type="button" className="btn btn-ghost small" disabled={!available(a.id)} onClick={() => setPicks([...picks, a.id])}>+</button>
              </span>
            </div>
          )
        })}
      </div>

      {picks.includes('traits') && (
        <>
          <p className="field-title">Tratti da aumentare</p>
          <div className="chip-grid">
            {unmarked.map(t => (
              <button key={t} type="button" className={`chip ${traitUps.includes(t) ? 'sel hope' : ''}`}
                onClick={() => setTraitUps(toggle(traitUps, t, 2 * picks.filter(p => p === 'traits').length))}>
                <span>{IT.traits[t]}</span><b>{fmt(d.traits[t])}</b>
              </button>
            ))}
          </div>
        </>
      )}

      {picks.includes('experience') && (
        <>
          <p className="field-title">Esperienze da aumentare</p>
          <div className="chip-grid">
            {d.experiences.map((e, i) => (
              <button key={i} type="button" className={`chip ${expUps.includes(i) ? 'sel hope' : ''}`} onClick={() => setExpUps(toggle(expUps, i, 2))}>
                <span>{e.name}</span><b>{fmt(e.bonus)}</b>
              </button>
            ))}
          </div>
        </>
      )}

      {picks.includes('multiclass') && (
        <div className="panel detail">
          <h3>Multiclasse</h3>
          <div className="two-col">
            <label className="field"><span>Classe</span>
              <select value={mc.class_id} onChange={e => setMc({ class_id: e.target.value, domain: '', subclass_id: '' })}>
                <option value="">Scegli</option>
                {CLASSES.filter(x => x.id !== cls.id).map(x => <option key={x.id} value={x.id}>{className(x.id)}</option>)}
              </select>
            </label>
            {mcClass && (
              <label className="field"><span>Dominio</span>
                <select value={mc.domain} onChange={e => setMc({ ...mc, domain: e.target.value })}>
                  <option value="">Scegli</option>
                  {mcClass.domains.map(x => <option key={x} value={x}>{domainName(x)}</option>)}
                </select>
              </label>
            )}
            {mcClass && (
              <label className="field"><span>Sottoclasse (base)</span>
                <select value={mc.subclass_id} onChange={e => setMc({ ...mc, subclass_id: e.target.value })}>
                  <option value="">Scegli</option>
                  {mcClass.subclasses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>
      )}

      <p className="field-title">Nuova carta dominio <small>({cards.length}/{cardsNeeded})</small></p>
      <div className="seg">
        {domains.map(x => <button key={x} type="button" className={dom === x ? 'sel' : ''} onClick={() => setDom(x)}>{domainName(x)}</button>)}
      </div>
      <div className="card-grid">
        {pool.filter(x => x.domain === dom).map(card => (
          <DomainCardView key={card.id} card={card} selected={cards.includes(card.id)} dim={!cards.includes(card.id) && cards.length >= cardsNeeded}
            onClick={() => setCards(toggle(cards, card.id, cardsNeeded))} />
        ))}
      </div>

      <p className="hint">Le soglie di danno salgono di 1 automaticamente.</p>
      <ErrorLine error={err} />
      <button className="btn btn-primary" onClick={confirm}>Passa al livello {L}</button>
    </Sheet>
  )
}
