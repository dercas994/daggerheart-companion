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
