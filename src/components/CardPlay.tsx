import type { Character, Roll } from '../lib/types'
import { actionCost, cannotUse, cardActions, cardDamageText, type CardAction } from '../lib/cardEffects'

export interface CardFlow {
  card: { id: string; name: string }
  action: CardAction
  /** Il tiro fatto per la carta, quando arriva. */
  roll?: Roll
  paid: boolean
}

/** Pulsanti delle azioni giocabili di una carta. */
export function CardActionButtons({ cardId, cardName, c, canEdit, busy, onPlay }: {
  cardId: string; cardName: string; c: Character; canEdit: boolean; busy?: boolean
  onPlay?: (card: { id: string; name: string }, a: CardAction) => void
}) {
  const actions = cardActions(cardId)
  if (!canEdit || !onPlay || !actions.length) return null
  return (
    <div className="card-play">
      {actions.map(a => {
        const why = cannotUse(a, c)
        const cost = actionCost(a)
        return (
          <button key={a.id} type="button" className={`btn small ${a.hope ? 'btn-hope' : 'btn-primary'}`} disabled={!!why || busy} title={why ?? undefined}
            onClick={() => onPlay({ id: cardId, name: cardName }, a)}>
            {a.label}{cost ? `, ${cost}` : ''}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Pannello che accompagna l'uso di una carta dopo il tiro:
 * esito, danni da tirare con la Competenza già contata, extra facoltativi.
 */
export function CardFlowDock({ flow, c, onDamage, onClose }: {
  flow: CardFlow; c: Character
  onDamage: (dice: string, prof: boolean | undefined, type: 'mag' | 'phy', label: string) => void
  onClose: () => void
}) {
  const { action: a, roll, card } = flow
  const waiting = !!a.roll && !roll
  const prof = c.data.proficiency ?? 1
  const fear = roll?.outcome === 'fear'
  const dmg = a.damage ? (fear && a.damage.onFear ? a.damage.onFear : a.damage.dice) : null
  return (
    <aside className="card-flow" role="status">
      <header>
        <b>{card.name}</b>
        <button className="link-btn" onClick={onClose}>{waiting ? 'Annulla' : 'Fine'}</button>
      </header>
      {waiting && <p className="hint">Fai il Tiro Incantesimo: il costo si paga quando tiri.</p>}
      {roll && (
        <p className={`cf-outcome tone-${roll.outcome ?? 'info'}`}>
          Tiro: <b>{roll.total}</b> {roll.outcome === 'crit' ? 'critico' : roll.outcome === 'hope' ? 'con Speranza' : 'con Paura'}.
        </p>
      )}
      {!waiting && a.damage && dmg && (
        <div className="cf-actions">
          <button className="btn btn-dmg" onClick={() => onDamage(dmg, a.damage!.prof, a.damage!.type, card.name)}>
            Tira i danni: {cardDamageText(dmg, prof, a.damage.prof, a.damage.type)}
          </button>
          {a.extras?.map(x => (
            <button key={x.label} className="btn btn-ghost small" onClick={() => onDamage(x.dice, false, x.type, `${card.name}, ${x.label.split(':')[0]}`)}>{x.label}</button>
          ))}
          {a.damage.to && <p className="hint">Danni {a.damage.to}.{roll?.outcome === 'crit' ? ' Critico: attiva «Critico» nel tiro dei danni.' : ''}</p>}
        </div>
      )}
      {!waiting && a.note && <p className="hint">{a.note}</p>}
    </aside>
  )
}
