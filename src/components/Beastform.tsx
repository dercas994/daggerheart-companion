import { useEffect, useMemo, useState } from 'react'
import { getBeastform, type Beastform } from '../data/beastforms'
import { IT } from '../data'
import { beastformsUpTo, beastKey, beastStress, beastView, type BeastView } from '../lib/beast'
import { tierOf, weaponDamage } from '../lib/rules'
import { TRAITS, type BeastState, type Character, type TraitKey } from '../lib/types'
import type { CardAction } from '../lib/cardEffects'
import { CardActionButtons } from './CardPlay'
import { Sheet } from './ui'

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

/** Riga di statistiche di una forma (o della vista calcolata). */
function Stats({ v, prof }: { v: Pick<BeastView, 'trait' | 'traitBonus' | 'evasion' | 'attack'>; prof?: number }) {
  return (
    <span className="beast-stats">
      {v.trait && <span>{IT.traits[v.trait]} {fmt(v.traitBonus)}</span>}
      <span>Evasione {fmt(v.evasion)}</span>
      {v.attack && <span>Attacco: {IT.range[v.attack.range as keyof typeof IT.range] ?? v.attack.range}, {prof ? weaponDamage(v.attack.damage, prof) : v.attack.damage.replace(' phy', ' fis')}</span>}
    </span>
  )
}

function FormDetails({ b }: { b: Beastform }) {
  return (
    <div className="beast-details">
      {!b.evolved && <Stats v={{ trait: b.trait, traitBonus: b.traitBonus ?? 0, evasion: b.evasion ?? 0, attack: b.attack }} />}
      {b.advantages.length > 0 && <p className="hint">Vantaggio per: {b.advantages.join(', ')}</p>}
      {b.features.map(f => <p key={f.name} className="beast-feat"><b>{f.name}.</b> {f.text}</p>)}
    </div>
  )
}

/** Scelta della Forma Bestiale. Con `evolution` si paga 3 Speranze al posto dello Stress e si sceglie un tratto a +1. */
export function BeastSheet({ open, onClose, c, evolution, onTransform }: {
  open: boolean; onClose: () => void; c: Character; evolution?: boolean
  onTransform: (s: BeastState, cost: { stress: number; hope: number }) => void
}) {
  const tier = tierOf(c.level)
  const forms = useMemo(() => beastformsUpTo(tier), [tier])
  const [pick, setPick] = useState<string | null>(null)
  const [base, setBase] = useState<string | null>(null)
  const [hForms, setHForms] = useState<string[]>([])
  const [feats, setFeats] = useState<string[]>([])
  const [advs, setAdvs] = useState<string[]>([])
  const [evo, setEvo] = useState<TraitKey | null>(null)
  useEffect(() => { if (open) { setPick(null); setBase(null); setHForms([]); setFeats([]); setAdvs([]); setEvo(null) } }, [open])
  useEffect(() => { setBase(null); setHForms([]); setFeats([]); setAdvs([]) }, [pick])

  const b = pick ? getBeastform(pick) : undefined
  const stress = b ? (evolution ? 0 : 1) + (b.hybrid?.stress ?? 0) : 1
  const hope = evolution ? 3 : 0
  const freeStress = c.stress_max - c.stress_marked
  const toggle = (xs: string[], x: string, max: number) => xs.includes(x) ? xs.filter(y => y !== x) : xs.length < max ? [...xs, x] : xs

  const hybridPool = b?.hybrid ? hForms.map(id => getBeastform(id)!).filter(Boolean) : []
  const ready = !!b && (!b.evolved || !!base) && (!b.hybrid || (hForms.length === b.hybrid.forms && feats.length === b.hybrid.features && advs.length === b.hybrid.advantages)) && (!evolution || !!evo)
  const why = stress > freeStress ? 'Stress insufficiente' : hope > c.hope ? 'Speranza insufficiente' : null

  const byTier = [1, 2, 3, 4].filter(t => t <= tier).map(t => ({ t, list: forms.filter(f => f.tier === t) }))

  return (
    <Sheet open={open} onClose={onClose} title={evolution ? 'Evoluzione' : 'Forma Bestiale'} wide>
      <p className="hint">
        {evolution ? 'Spendi 3 Speranze per trasformarti senza segnare Stress, e scegli un tratto a +1 finché resti nella forma.' : 'Segni uno Stress e ti trasformi in una creatura del tuo rango o inferiore.'}
        {' '}Finché sei trasformato non usi armi né incantesimi delle carte dominio.
      </p>
      {byTier.map(({ t, list }) => (
        <div key={t} className="beast-tier">
          <p className="field-title">Rango {t}</p>
          <div className="beast-list">
            {list.map(f => (
              <div key={f.id} className={`list-item ${pick === f.id ? 'sel' : ''}`}>
                <button type="button" className="beast-pick" aria-expanded={pick === f.id} onClick={() => setPick(pick === f.id ? null : f.id)}>
                  <b>{f.name}</b> <small>{f.examples}</small>
                </button>
                {pick === f.id && <FormDetails b={f} />}
              </div>
            ))}
          </div>
        </div>
      ))}

      {b?.evolved && (
        <>
          <p className="field-title">Quale creatura evolvi?</p>
          <div className="chip-grid">
            {beastformsUpTo(b.evolved.maxTier).filter(f => !f.evolved && !f.hybrid).map(f => (
              <button key={f.id} type="button" className={`chip ${base === f.id ? 'sel' : ''}`} onClick={() => setBase(f.id)}>{f.name}</button>
            ))}
          </div>
          {base && <Stats v={beastView({ id: b.id, base })!} prof={c.data.proficiency} />}
        </>
      )}

      {b?.hybrid && (
        <>
          <p className="field-title">Scegli {b.hybrid.forms} forme ({hForms.length}/{b.hybrid.forms})</p>
          <div className="chip-grid">
            {beastformsUpTo(b.hybrid.maxTier).filter(f => !f.evolved && !f.hybrid).map(f => (
              <button key={f.id} type="button" className={`chip ${hForms.includes(f.id) ? 'sel' : ''}`} onClick={() => {
                const next = toggle(hForms, f.id, b.hybrid!.forms)
                setHForms(next)
                setFeats(feats.filter(k => next.some(id => k.startsWith(`bf:${id}:`))))
                setAdvs(advs.filter(a => next.some(id => getBeastform(id)!.advantages.includes(a))))
              }}>{f.name}</button>
            ))}
          </div>
          {hybridPool.length > 0 && (
            <>
              <p className="field-title">Vantaggi ({advs.length}/{b.hybrid.advantages})</p>
              <div className="chip-grid">
                {[...new Set(hybridPool.flatMap(f => f.advantages))].map(a => (
                  <button key={a} type="button" className={`chip ${advs.includes(a) ? 'sel' : ''}`} onClick={() => setAdvs(toggle(advs, a, b.hybrid!.advantages))}>{a}</button>
                ))}
              </div>
              <p className="field-title">Privilegi ({feats.length}/{b.hybrid.features})</p>
              <div className="chip-grid">
                {hybridPool.flatMap(f => f.features.map((x, i) => ({ k: beastKey(f.id, i), name: x.name, from: f.name }))).filter((x, i, all) => all.findIndex(y => y.name === x.name) === i).map(x => (
                  <button key={x.k} type="button" className={`chip ${feats.includes(x.k) ? 'sel' : ''}`} onClick={() => setFeats(toggle(feats, x.k, b.hybrid!.features))}>{x.name} <small>({x.from})</small></button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {evolution && b && (
        <>
          <p className="field-title">Tratto a +1</p>
          <div className="chip-grid">
            {TRAITS.map(t => <button key={t} type="button" className={`chip ${evo === t ? 'sel hope' : ''}`} onClick={() => setEvo(t)}>{IT.traits[t]}</button>)}
          </div>
        </>
      )}

      {b && (
        <button className="btn btn-primary beast-go" disabled={!ready || !!why} title={why ?? undefined} onClick={() => {
          onTransform({ id: b.id, ...(base ? { base } : {}), ...(b.hybrid ? { forms: hForms, feats, advs } : {}), ...(evo ? { evo } : {}) }, { stress, hope })
        }}>
          Trasformati{[hope ? `${hope} Speranza` : '', stress ? `${stress} Stress` : ''].filter(Boolean).map(s => `, ${s}`).join('')}
        </button>
      )}
      {b && why && <p className="hint">{why}.</p>}
    </Sheet>
  )
}

/** Forma in corso: statistiche, vantaggi, privilegi giocabili, uscita. */
export function BeastPanel({ c, canEdit, onExit, onPlay, onTokens }: {
  c: Character; canEdit: boolean; onExit: () => void
  onPlay?: (card: { id: string; name: string }, a: CardAction) => void; onTokens?: (cardId: string, n: number) => void
}) {
  const v = beastView(c.data.beastform)
  if (!v) return null
  return (
    <section className="beast-panel panel">
      <div className="beast-head">
        <div>
          <p className="beast-kicker">In Forma Bestiale</p>
          <h2>{v.name}</h2>
        </div>
        {canEdit && <button className="btn btn-ghost small" onClick={onExit}>Torna normale</button>}
      </div>
      <Stats v={v} prof={c.data.proficiency} />
      {v.evo && <p className="hint">Evoluzione: {IT.traits[v.evo]} +1.</p>}
      {v.advantages.length > 0 && <p className="beast-adv">Vantaggio per: <b>{v.advantages.join(', ')}</b></p>}
      <ul className="beast-feats">
        {v.features.filter(f => !/^(Evoluta|Ibrido)$/.test(f.name)).map(f => (
          <li key={f.key}>
            <p><b>{f.name}.</b> {f.text}</p>
            <CardActionButtons cardId={f.key} cardName={f.name} c={c} canEdit={canEdit} onPlay={onPlay} onTokens={onTokens} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export { beastStress }
