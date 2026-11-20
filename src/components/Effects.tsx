import { useEffect, useMemo, useRef, useState } from 'react'

/** Generatore pseudo-casuale con seme: le stesse crepe a ogni render della stessa scheda. */
function rng(seed: string) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296 }
}

/**
 * Crepe di vetro che partono da un punto (l'ultimo cuore) e si allargano sulla scheda.
 * Si disegnano quando compaiono; poi restano finché il PG è a terra.
 */
export function DeathCrack({ seed, x, y, label = 'Mossa di morte' }: { seed: string; x: number; y: number; label?: string }) {
  const lines = useMemo(() => {
    const r = rng(seed)
    const out: { d: string; delay: number; w: number }[] = []
    const n = 9
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.5
      let px = x, py = y, ang = a
      let d = `M${px.toFixed(1)},${py.toFixed(1)}`
      const segs = 4 + Math.floor(r() * 4)
      for (let s = 0; s < segs; s++) {
        ang += (r() - 0.5) * 0.9
        const len = 6 + r() * 14
        px += Math.cos(ang) * len; py += Math.sin(ang) * len * 0.75
        d += ` L${px.toFixed(1)},${py.toFixed(1)}`
        // ramificazioni corte
        if (r() < 0.35) {
          const b = ang + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6), bl = 4 + r() * 8
          out.push({ d: `M${px.toFixed(1)},${py.toFixed(1)} L${(px + Math.cos(b) * bl).toFixed(1)},${(py + Math.sin(b) * bl * 0.75).toFixed(1)}`, delay: 0.15 + s * 0.06, w: 0.5 })
        }
      }
      out.push({ d, delay: r() * 0.12, w: 0.9 + r() * 0.5 })
    }
    // anello d'impatto
    const ring: string[] = []
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2, rr = 3.5 + r() * 2
      ring.push(`${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr * 0.75).toFixed(1)}`)
    }
    out.push({ d: `M${ring.join(' L')}`, delay: 0, w: 0.7 })
    return out
  }, [seed, x, y])

  return (
    <div className="death-crack" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.map((l, i) => <path key={i} d={l.d} pathLength={1} style={{ animationDelay: `${l.delay}s`, strokeWidth: l.w }} vectorEffect="non-scaling-stroke" />)}
      </svg>
      <span className="dc-label">{label}</span>
    </div>
  )
}

/** Cenere che si stacca dalla scheda di un avversario sconfitto e scivola via. */
export function AshBurst({ id }: { id: string }) {
  const bits = useMemo(() => {
    const r = rng(id)
    return Array.from({ length: 60 }, (_, i) => {
      const x = r() * 100
      // i frammenti si staccano seguendo il fronte che brucia da sinistra a destra
      return { k: i, x, y: r() * 100, s: 3 + r() * 6, dx: 30 + r() * 90, dy: -30 + r() * 80, delay: (x / 100) * 1.1 + r() * 0.2, dur: 1.2 + r() * 1.2 }
    })
  }, [id])
  return (
    <div className="ash-burst" aria-hidden="true">
      {bits.map(b => (
        <i key={b.k} style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.s, height: b.s, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, ['--dx' as any]: `${b.dx}px`, ['--dy' as any]: `${b.dy}px` }} />
      ))}
    </div>
  )
}

/**
 * Riposo lungo: la pagina passa alla notte, la luna attraversa il cielo,
 * poi torna l'alba. Non blocca nulla e si chiude da sola.
 */
export function LongRestSky({ run, onDone }: { run: number; onDone: () => void }) {
  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ k: i, x: Math.random() * 100, y: Math.random() * 60, s: 1 + Math.random() * 2.2, d: Math.random() * 1.5 })), [run])
  const done = useRef(onDone); done.current = onDone
  useEffect(() => {
    if (!run) return
    const t = setTimeout(() => done.current(), 4600)
    return () => clearTimeout(t)
  }, [run])
  if (!run) return null
  return (
    <div className="rest-sky" key={run} aria-hidden="true" onClick={() => done.current()}>
      <div className="rs-night" />
      {stars.map(s => <i key={s.k} className="rs-star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${0.4 + s.d}s` }} />)}
      <div className="rs-moon-path"><span className="rs-moon" /></div>
      <div className="rs-dawn" />
      <div className="rs-sun" />
      <p className="rs-text">Riposo lungo</p>
    </div>
  )
}

/** Restituisce un numero che cambia ogni volta che il valore cresce (per far ripartire un effetto). */
export function useRise(value: number | undefined) {
  const prev = useRef(value)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (prev.current !== undefined && value !== undefined && value > prev.current) setTick(Date.now())
    prev.current = value
  }, [value])
  return tick
}
