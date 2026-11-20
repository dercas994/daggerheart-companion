import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Quando il master spende Paura, ai giocatori sale dai bordi dello schermo
 * un fumo viola per qualche secondo. Non blocca nulla: è solo atmosfera.
 */
export function FearAura({ fear, enabled }: { fear: number | undefined; enabled: boolean }) {
  const prev = useRef<number | undefined>(undefined)
  const [burst, setBurst] = useState<{ id: number; spent: number } | null>(null)

  useEffect(() => {
    const before = prev.current
    prev.current = fear
    if (!enabled || before === undefined || fear === undefined || fear >= before) return
    const id = Date.now()
    setBurst({ id, spent: before - fear })
    navigator.vibrate?.([40, 60, 40])
    const t = setTimeout(() => setBurst(b => (b?.id === id ? null : b)), 4200)
    return () => clearTimeout(t)
  }, [fear, enabled])

  // volute di fumo distribuite lungo i quattro bordi
  const puffs = useMemo(() => {
    if (!burst) return []
    return Array.from({ length: 22 }, (_, i) => {
      const side = i % 4
      const along = 5 + Math.random() * 90
      const size = 120 + Math.random() * 160
      return { k: i, side, along, size, delay: Math.random() * 0.7, dur: 2.4 + Math.random() * 1.4 }
    })
  }, [burst?.id])

  if (!burst) return null
  return (
    <div className="fear-aura" key={burst.id} aria-hidden="true">
      <div className="fa-vignette" />
      {puffs.map(p => (
        <span key={p.k} className={`fa-puff side-${p.side}`}
          style={{ ['--along' as any]: `${p.along}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
      <p className="fa-text">Il master spende {burst.spent === 1 ? 'una Paura' : `${burst.spent} Paure`}</p>
    </div>
  )
}

/**
 * Effetto personale: quando il PG del giocatore guadagna Speranza, dai bordi sale
 * una luce dorata. Solo sullo schermo di chi lo gioca. Se c'è un tiro a schermo,
 * aspetta che i dadi si fermino.
 */
export function HopeAura({ hope, enabled, wait = false, name }: { hope: number | undefined; enabled: boolean; wait?: boolean; name?: string }) {
  const prev = useRef<number | undefined>(undefined)
  const waitRef = useRef(wait)
  waitRef.current = wait
  const [burst, setBurst] = useState<{ id: number; gained: number } | null>(null)

  useEffect(() => {
    const before = prev.current
    prev.current = hope
    if (!enabled || before === undefined || hope === undefined || hope <= before) return
    const id = Date.now()
    const gained = hope - before
    const start = setTimeout(() => {
      setBurst({ id, gained })
      navigator.vibrate?.(30)
    }, waitRef.current ? 1500 : 0)
    const end = setTimeout(() => setBurst(b => (b?.id === id ? null : b)), (waitRef.current ? 1500 : 0) + 3600)
    return () => { clearTimeout(start); clearTimeout(end) }
  }, [hope, enabled])

  const motes = useMemo(() => {
    if (!burst) return []
    return Array.from({ length: 26 }, (_, i) => {
      const side = i % 4
      return { k: i, side, along: 5 + Math.random() * 90, size: 90 + Math.random() * 140, delay: Math.random() * 0.6, dur: 2 + Math.random() * 1.2 }
    })
  }, [burst?.id])
  const sparks = useMemo(() => burst ? Array.from({ length: 18 }, (_, i) => ({ k: i, x: Math.random() * 100, delay: Math.random() * 1.2, dur: 1.6 + Math.random() * 1.2 })) : [], [burst?.id])

  if (!burst) return null
  return (
    <div className="fear-aura hope-aura" key={burst.id} aria-hidden="true">
      <div className="fa-vignette" />
      {motes.map(p => (
        <span key={p.k} className={`fa-puff side-${p.side}`}
          style={{ ['--along' as any]: `${p.along}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
      {sparks.map(s => <i key={s.k} className="ha-spark" style={{ left: `${s.x}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />)}
      <p className="fa-text">{name ? `${name}: ` : ''}+{burst.gained} {burst.gained === 1 ? 'Speranza' : 'Speranze'}</p>
    </div>
  )
}
