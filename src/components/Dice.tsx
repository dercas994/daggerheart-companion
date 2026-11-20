import { useEffect, useMemo, useState } from 'react'
import type { Roll } from '../lib/types'
import { DAMAGE_TYPE_IT } from '../lib/rules'
import { DieShape } from './DiceSheet'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Vista frontale di un d12: faccia pentagonale al centro dentro un decagono. */
function D12({ value, tone }: { value: number; tone: 'hope' | 'fear' }) {
  const { outer, inner, spokes } = useMemo(() => {
    const R = 46, r = 25
    const pt = (rad: number, a: number) => [50 + rad * Math.cos(a), 50 + rad * Math.sin(a)]
    const outer = Array.from({ length: 10 }, (_, i) => pt(R, -Math.PI / 2 + (i * Math.PI) / 5))
    const inner = Array.from({ length: 5 }, (_, i) => pt(r, -Math.PI / 2 + (i * 2 * Math.PI) / 5))
    const spokes = inner.map((p, i) => [p, outer[i * 2]])
    return { outer, inner, spokes }
  }, [])
  const poly = (ps: number[][]) => ps.map(p => p.join(',')).join(' ')
  return (
    <svg viewBox="0 0 100 100" className={`d12 d12-${tone}`} aria-hidden="true">
      <polygon points={poly(outer)} className="d12-body" />
      {spokes.map(([a, b], i) => <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="d12-edge" />)}
      <polygon points={poly(inner)} className="d12-face" />
      <text x="50" y="51" className="d12-num" dominantBaseline="middle" textAnchor="middle">{value}</text>
    </svg>
  )
}

const OUTCOME_TITLE = { hope: 'con Speranza', fear: 'con Paura', crit: 'Successo critico' }

type OverlayProps = { roll: Roll; onClose: () => void; ownRoll?: boolean }
export function DiceOverlay(p: OverlayProps) {
  return p.roll.kind && p.roll.kind !== 'duality' ? <DamageOverlay {...p} /> : <DualityOverlay {...p} />
}

function useCloseKeys(onClose: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') onClose() }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [onClose])
}

/** Danni e dadi liberi: i dadi rotolano, poi compare il totale. */
function DamageOverlay({ roll, onClose, ownRoll = true }: OverlayProps) {
  const fast = reduced()
  const skip = fast || !!roll.manual
  const groups = roll.dice?.groups ?? []
  const flat = useMemo(() => groups.flatMap(g => (g.rolls.length ? g.rolls : Array.from({ length: g.n }, () => 0)).map(v => ({ sides: g.sides, v }))), [roll.id])
  const [phase, setPhase] = useState<'tumble' | 'reveal'>(skip ? 'reveal' : 'tumble')
  const [faces, setFaces] = useState(() => flat.map(d => d.v))
  useCloseKeys(onClose)
  useEffect(() => {
    if (skip) return
    const flick = setInterval(() => setFaces(flat.map(d => 1 + Math.floor(Math.random() * d.sides))), 70)
    const stop = setTimeout(() => { clearInterval(flick); setFaces(flat.map(d => d.v)) }, 900)
    const rev = setTimeout(() => setPhase('reveal'), 1050)
    navigator.vibrate?.(30)
    return () => { clearInterval(flick); clearTimeout(stop); clearTimeout(rev) }
  }, [roll.id])
  useEffect(() => { if (phase === 'reveal' && !fast) navigator.vibrate?.(roll.crit ? [30, 30, 90] : 50) }, [phase])

  const tone = roll.kind === 'damage' ? `dmg-${roll.damage_type ?? 'phy'}` : 'dmg-free'
  const parts: string[] = []
  for (const g of groups) parts.push(g.rolls.length ? `${g.n}d${g.sides} (${g.rolls.join(', ')})` : `${g.n}d${g.sides}`)
  if (roll.manual) parts.push(`somma ${roll.total - (roll.dice?.bonus ?? 0) - (roll.dice?.crit_bonus ?? 0)}`)
  if (roll.dice?.crit_bonus) parts.push(`critico ${roll.dice.crit_bonus}`)
  if (roll.dice?.bonus) parts.push(String(roll.dice.bonus))
  const big = flat.length > 8

  return (
    <div className={`dice-overlay dmg-overlay phase-${phase} ${tone} ${roll.crit ? 'is-crit' : ''}`} onClick={onClose} role="dialog" aria-label="Risultato del tiro">
      <div className="fx fx-flash" />
      <div className="dice-stage">
        {!ownRoll && <p className="dice-who">{roll.roller_name}</p>}
        {!roll.manual && (
          <div className={`dmg-dice ${big ? 'many' : ''}`}>
            {flat.map((d, i) => (
              <span key={i} className="dmg-die" style={{ animationDelay: `${(i % 8) * 40}ms` }}>
                <DieShape sides={d.sides} /><b>{faces[i]}</b><small>d{d.sides}</small>
              </span>
            ))}
          </div>
        )}
        <div className="dice-result" aria-live="assertive">
          {roll.label && <p className="dice-label-line">{roll.label}</p>}
          {roll.manual && <p className="dice-manual">dadi fisici</p>}
          <p className="dice-total">{roll.total}</p>
          <p className="dice-outcome">{roll.kind === 'damage' ? `danni ${DAMAGE_TYPE_IT[roll.damage_type ?? 'phy']}` : 'totale'}</p>
          {roll.crit && <p className="dice-effect">Critico: massimo dei dadi aggiunto</p>}
          <p className="dice-math">{parts.join(' + ')}</p>
          <p className="dice-hint">Tocca per chiudere</p>
        </div>
      </div>
    </div>
  )
}

function DualityOverlay({ roll, onClose, ownRoll = true }: OverlayProps) {
  const fast = reduced()
  // con i dadi fisici il risultato è già noto: niente rotolamento, solo la rivelazione
  const skip = fast || !!roll.manual
  const [phase, setPhase] = useState<'tumble' | 'reveal'>(skip ? 'reveal' : 'tumble')
  const [faces, setFaces] = useState<[number, number]>([roll.hope_die, roll.fear_die])

  useEffect(() => {
    if (skip) return
    const flick = setInterval(() => setFaces([1 + Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 12)]), 70)
    const stop = setTimeout(() => { clearInterval(flick); setFaces([roll.hope_die, roll.fear_die]) }, 1050)
    const rev = setTimeout(() => setPhase('reveal'), 1250)
    navigator.vibrate?.(30)
    return () => { clearInterval(flick); clearTimeout(stop); clearTimeout(rev) }
  }, [roll.id])

  useEffect(() => {
    if (phase === 'reveal' && !fast) navigator.vibrate?.(roll.outcome === 'fear' ? [60, 40, 60] : roll.outcome === 'crit' ? [30, 30, 30, 30, 90] : 50)
  }, [phase])

  useCloseKeys(onClose)

  const sparks = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    left: 8 + Math.random() * 84, delay: Math.random() * 0.9, dur: 1.4 + Math.random() * 1.6, size: 3 + Math.random() * 5, drift: (Math.random() - 0.5) * 80, k: i,
  })), [roll.id])

  let math = `${roll.hope_die} + ${roll.fear_die}`
  if (roll.adv_die) math += roll.adv_die > 0 ? ` + ${roll.adv_die} (vantaggio)` : ` − ${-roll.adv_die} (svantaggio)`
  if (roll.modifier) math += roll.modifier > 0 ? ` + ${roll.modifier}` : ` − ${-roll.modifier}`

  const effect = roll.reaction ? 'Tiro di reazione: niente Speranza né Paura'
    : roll.group_id && !roll.effects ? 'Tiro Combinato: poi scegliete quale risultato usare'
    : roll.effects ? (roll.effects.fear != null ? `Il master guadagna ${roll.effects.fear} Paura` : `+1 Speranza a entrambi${roll.outcome === 'crit' ? ' e −1 Stress' : ''}`)
    : roll.outcome === 'fear'
    ? 'Il master guadagna 1 Paura'
    : roll.character_id
      ? roll.outcome === 'crit' ? '+1 Speranza e −1 Stress' : '+1 Speranza'
      : ''

  return (
    <div className={`dice-overlay phase-${phase} out-${roll.outcome}`} onClick={onClose} role="dialog" aria-label="Risultato del tiro">
      <div className="fx fx-rays" />
      <div className="fx fx-smoke"><i /><i /><i /><i /></div>
      <div className="fx fx-flash" />
      <div className="fx fx-sparks">
        {sparks.map(s => (
          <span key={s.k} style={{ left: `${s.left}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`, width: s.size, height: s.size, ['--drift' as any]: `${s.drift}px` }} />
        ))}
      </div>

      <div className="dice-stage">
        {!ownRoll && <p className="dice-who">{roll.roller_name}</p>}
        <div className="dice-pair">
          <div className={`die-wrap die-hope ${roll.outcome !== 'fear' ? 'winner' : 'loser'}`}>
            <D12 value={faces[0]} tone="hope" />
            <span className="die-label">Speranza</span>
          </div>
          <div className={`die-wrap die-fear ${roll.outcome !== 'hope' ? 'winner' : 'loser'}`}>
            <D12 value={faces[1]} tone="fear" />
            <span className="die-label">Paura</span>
          </div>
        </div>

        <div className="dice-result" aria-live="assertive">
          {roll.label && <p className="dice-label-line">{roll.label}</p>}
          {roll.manual && <p className="dice-manual">dadi fisici</p>}
          <p className="dice-total">{roll.total}</p>
          <p className="dice-outcome">{roll.outcome && OUTCOME_TITLE[roll.outcome]}</p>
          <p className="dice-math">{math}</p>
          {effect && <p className="dice-effect">{effect}</p>}
          <p className="dice-hint">Tocca per chiudere</p>
        </div>
      </div>
    </div>
  )
}

export function outcomeText(r: Roll) {
  const what = r.kind === 'damage' ? `danni ${DAMAGE_TYPE_IT[r.damage_type ?? 'phy']}${r.crit ? ' (critico)' : ''}`
    : r.kind === 'dice' ? `con ${(r.dice?.groups ?? []).map(g => `${g.n}d${g.sides}`).join(' + ')}`
    : r.outcome ? OUTCOME_TITLE[r.outcome] : ''
  return `${r.roller_name}: ${r.total} ${what}${r.label ? ` (${r.label})` : ''}`
}
export const rollTone = (r: Roll) => r.outcome ?? 'info'
