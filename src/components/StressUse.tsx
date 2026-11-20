import type { Character } from '../lib/types'
import { bonusText, stressUses, type StressUse } from '../lib/costs'

/** Pulsanti «Segna N Stress» per ogni uso volontario di Stress scritto nel testo di una capacità. */
export function StressButtons({ text, src, c, canEdit, onUse }: {
  text: string; src: string; c: Character; canEdit: boolean; onUse?: (u: StressUse, src: string) => void
}) {
  if (!canEdit || !onUse) return null
  const uses = stressUses(text)
  if (!uses.length) return null
  return (
    <div className="stress-uses">
      {uses.map((u, i) => (
        <button key={i} type="button" className="btn btn-ghost small btn-stress" disabled={c.stress_marked + u.stress > c.stress_max}
          title={u.what} onClick={e => { e.stopPropagation(); onUse(u, src) }}>
          Segna {u.stress} Stress{u.bonus ? `: ${bonusText(u.bonus)}` : uses.length > 1 ? `: ${u.what.slice(0, 40)}${u.what.length > 40 ? '…' : ''}` : ''}
        </button>
      ))}
    </div>
  )
}
