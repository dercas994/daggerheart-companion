/**
 * Effetti giocabili delle carte dominio.
 *
 * Ogni carta può avere una o più azioni. Un'azione dice cosa costa, se richiede
 * un tiro (di solito il Tiro Incantesimo) e cosa succede dopo: danni da tirare,
 * cure, bonus al prossimo tiro. La schermata del personaggio esegue i passi in ordine.
 */
import type { Character, TraitKey } from './types'
import type { PendingBonus } from './costs'

export interface CardDamage {
  /** Dado base, es. "d8+2". Con `prof` il numero di dadi è la Competenza. */
  dice: string
  prof?: boolean
  type: 'mag' | 'phy'
  /** Danno diverso se il tiro è con Paura (es. Folgore Avvizzente). */
  onFear?: string
  /** Etichetta del pulsante, es. "ai bersagli colpiti". */
  to?: string
}

export interface CardAction {
  id: string
  /** Testo del pulsante, es. "Lancia". */
  label: string
  hope?: number
  stress?: number
  /** Tiro di dualità richiesto: 'spellcast' = tratto da incantatore. */
  roll?: TraitKey | 'spellcast'
  /** Danni da tirare dopo un tiro riuscito (o subito, se non c'è tiro). */
  damage?: CardDamage
  /** Danni facoltativi in più, ciascuno con il suo pulsante (es. contro i Vulnerabili). */
  extras?: { label: string; dice: string; type: 'mag' | 'phy' }[]
  /** Effetto su di sé appena pagato il costo. */
  self?: Partial<Pick<Character, 'hp_marked' | 'stress_marked' | 'armor_marked' | 'hope'>>
  /** Bonus al prossimo tiro. */
  bonus?: Omit<PendingBonus, 'src'>
  /** Promemoria mostrato dopo l'uso: ciò che va gestito al tavolo. */
  note?: string
}

export const CARD_EFFECTS: Record<string, CardAction[]> = {
  'midnight-rain-of-blades': [{
    id: 'cast',
    label: 'Lancia',
    hope: 1,
    roll: 'spellcast',
    damage: { dice: 'd8+2', prof: true, type: 'mag', to: 'a tutti i bersagli colpiti entro distanza Prossima' },
    extras: [{ label: 'Bersaglio Vulnerabile: +1d8', dice: '1d8', type: 'mag' }],
    note: 'Il master ti dice contro quali bersagli il tiro ha successo: tira i danni una volta e applicali a tutti.',
  }],
}

export const cardActions = (id: string) => CARD_EFFECTS[id] ?? []

/** Dadi effettivi di un danno di carta, con la Competenza già contata. */
export function cardDamageSpec(dmg: string, proficiency: number, prof?: boolean) {
  const m = dmg.replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i)
  if (!m) return null
  const n = prof ? Math.max(1, proficiency) : (parseInt(m[1] || '1', 10))
  return { groups: [{ n, sides: parseInt(m[2], 10) }], bonus: m[3] ? parseInt(m[3], 10) : 0 }
}

/** Testo leggibile del danno, es. "2d8+2 magici". */
export function cardDamageText(dmg: string, proficiency: number, prof: boolean | undefined, type: 'mag' | 'phy') {
  const s = cardDamageSpec(dmg, proficiency, prof)
  if (!s) return dmg
  return `${s.groups[0].n}d${s.groups[0].sides}${s.bonus ? (s.bonus > 0 ? '+' : '') + s.bonus : ''} ${type === 'mag' ? 'magici' : 'fisici'}`
}

/** Perché un'azione non si può usare ora (null se si può). */
export function cannotUse(a: CardAction, c: Character): string | null {
  if (a.hope && c.hope < a.hope) return `Servono ${a.hope} Speranza`
  if (a.stress && c.stress_marked + a.stress > c.stress_max) return 'Non hai abbastanza Stress libero'
  return null
}

/** Etichetta del pulsante con il costo. */
export function actionCost(a: CardAction) {
  const parts: string[] = []
  if (a.hope) parts.push(`${a.hope} Speranza`)
  if (a.stress) parts.push(`${a.stress} Stress`)
  return parts.join(' e ')
}
