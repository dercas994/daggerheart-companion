/** Scorciatoie per scrivere le azioni delle carte in poche righe. */
import type { CardAction, CardDamage } from '../cardEffects'

type A = Partial<CardAction>
/** Incantesimo con Tiro Incantesimo. */
export const cast = (o: A = {}, id = 'cast', label = 'Lancia'): CardAction => ({ id, label, roll: 'spellcast', ...o })
/** Capacità senza tiro (solo costo ed effetto). */
export const use = (o: A = {}, id = 'use', label = 'Usa'): CardAction => ({ id, label, ...o })
/** Attacco con l'arma primaria. */
export const strike = (o: A = {}, id = 'strike', label = 'Attacca'): CardAction => ({ id, label, roll: 'weapon', damage: weapon(), ...o })

export const mag = (dice: string, o: Partial<CardDamage> = {}): CardDamage => ({ dice, type: 'mag', ...o })
export const phy = (dice: string, o: Partial<CardDamage> = {}): CardDamage => ({ dice, type: 'phy', ...o })
/** Danno con la Competenza come numero di dadi. */
export const magP = (dice: string, o: Partial<CardDamage> = {}) => mag(dice, { count: 'prof', ...o })
export const phyP = (dice: string, o: Partial<CardDamage> = {}) => phy(dice, { count: 'prof', ...o })
export const weapon = (o: Partial<CardDamage> = {}): CardDamage => ({ dice: 'weapon', type: 'phy', ...o })

/** Note ricorrenti. */
export const N = {
  gm: 'Il master ti dice contro chi riesce.',
  ally: 'L’effetto sull’alleato lo segna lui sulla sua scheda.',
  reaction: 'Chi fallisce il Tiro Reazione subisce il danno pieno; chi riesce, se la carta lo dice, metà.',
}
