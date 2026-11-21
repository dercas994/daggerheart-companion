/**
 * Effetti giocabili delle carte dominio.
 *
 * Ogni carta può avere una o più azioni. Un'azione dice cosa costa, se richiede
 * un tiro (di solito il Tiro Incantesimo) e cosa succede dopo: danni da tirare,
 * dadi da tirare, cure su di sé, bonus al prossimo tiro, segnalini sulla carta.
 * La schermata del personaggio esegue i passi in ordine.
 */
import type { Character, SheetData, TraitKey } from './types'
import type { PendingBonus } from './costs'
import { traitValue, spellcastTrait } from './rules'
import { CARDS_A } from './cards/a'
import { CARDS_B } from './cards/b'
import { CARDS_C } from './cards/c'
import { CLASS_FEATURES } from './cards/classes'

/** Da dove si prende un numero: un tratto, il tratto da incantatore, la Competenza, il livello, la Paura del GM, o un numero fisso. */
export type Source = TraitKey | 'spellcast' | 'prof' | 'level' | 'fear' | number

export interface CardDamage {
  /** Dado base, es. "d8+2", oppure 'weapon' per il danno dell'arma primaria. Il numero di dadi viene da `count`, altrimenti dalla formula. */
  dice: string
  count?: Source | 'scale' | 'tokens'
  /** Con il costo scelto: moltiplica tutta la formula per le unità spese. */
  perUnit?: boolean
  /** Solo arma: Competenza modificata (+1) o dimezzata. */
  profDelta?: number
  halfProf?: boolean
  type: 'mag' | 'phy'
  /** Danno diverso se il tiro è con Paura. */
  onFear?: string
  /** A chi si applica, es. "a tutti i bersagli colpiti". */
  to?: string
}

export interface CardAction {
  id: string
  /** Testo del pulsante, es. "Lancia". */
  label: string
  hope?: number
  stress?: number
  /** Slot Armatura da segnare come costo. */
  armor?: number
  /** Segnalini della carta da spendere. */
  tokens?: number
  /** I segnalini stanno su un altro privilegio (es. i Favori del warlock). */
  tokensFrom?: string
  /** Una volta per riposo / per riposo lungo. */
  per?: 'rest' | 'longRest'
  /**
   * Costo scelto al momento ("spendete un numero qualsiasi di Speranze"):
   * ogni unità paga la risorsa e moltiplica danni e dadi.
   */
  scale?: { by: 'hope' | 'stress' | 'tokens' | 'free'; max?: Source; what: string }
  /** Tiro di dualità richiesto ('weapon' = tratto dell'arma primaria). */
  roll?: TraitKey | 'spellcast' | 'weapon'
  /** Difficoltà nota del tiro, mostrata nell'etichetta. */
  difficulty?: number
  /** È un tiro di reazione. */
  reaction?: boolean
  /** Danni da tirare dopo il tiro. */
  damage?: CardDamage
  /** Danni facoltativi in più, ciascuno con il suo pulsante. */
  extras?: { label: string; dice: string; type: 'mag' | 'phy' }[]
  /** Dadi liberi da tirare (non danni), es. "riducete il danno di 1d8". */
  dice?: { dice: string; label: string; count?: Source | 'scale' | 'tokens'; perUnit?: boolean }
  /** Se nei dadi liberi esce questo numero, la carta si esaurisce fino al prossimo riposo. */
  exhaustOn?: number
  /** Le unità scelte si aggiungono ai segnalini della carta. */
  addTokens?: boolean
  /** Bonus calcolato al momento (es. il doppio della Forza). */
  bonusFn?: (c: Character, n: number) => Omit<PendingBonus, 'src'>
  /** Effetto su di sé appena pagato il costo (valori positivi = segna, negativi = libera). */
  self?: { hp?: number; stress?: number; armor?: number; hope?: number }
  /** Mette segnalini sulla carta (sostituisce quelli presenti). */
  fill?: Source
  /** Bonus al prossimo tiro. */
  bonus?: Omit<PendingBonus, 'src'>
  /** Dopo l'uso la carta va nel Rifugio. */
  toVault?: boolean
  /** Promemoria: ciò che va gestito al tavolo (effetti su alleati, condizioni, narrazione). */
  note?: string
}

export interface CardDef {
  actions: CardAction[]
  /** La carta tiene segnalini: mostro il contatore. */
  tokens?: boolean
  /** Nome del contatore (es. "Dado Inarrestabile") e suo massimo. */
  tokensLabel?: string
  tokensMax?: (c: Character) => number
  /** Effetto passivo già applicato dalla scheda: lo dico accanto al privilegio. */
  passive?: string
}

/** Dado Inarrestabile del Guardiano: valore attuale (0 = non attivo) e faccia massima. */
export const UNSTOPPABLE = 'cls:Inarrestabile'
export function unstoppable(c: Character) {
  const v = c.data.card_state?.[UNSTOPPABLE]?.tokens ?? 0
  return v > 0 ? { value: v, max: c.level >= 5 ? 6 : 4 } : null
}

const RAW: Record<string, CardAction[] | CardDef> = { ...CARDS_A, ...CARDS_B, ...CARDS_C, ...CLASS_FEATURES }

export function cardDef(id: string): CardDef | null {
  const r = RAW[id]
  if (!r) return null
  return Array.isArray(r) ? { actions: r, tokens: r.some(a => !a.tokensFrom && (a.fill !== undefined || a.tokens || a.scale?.by === 'tokens' || a.addTokens)) } : r
}
export const cardActions = (id: string) => cardDef(id)?.actions ?? []
/** Chiave di un privilegio di classe/sottoclasse. */
export const featureKey = (name: string) => `cls:${name}`
export const playableCount = () => Object.keys(RAW).length

/** Valore numerico di una sorgente per questo PG. */
export function sourceValue(src: Source | 'scale' | 'tokens', c: Character, fear = 0, n = 1, cardId = ''): number {
  if (typeof src === 'number') return src
  if (src === 'scale') return n
  if (src === 'tokens') return cardState(c, cardId).tokens ?? 0
  const d = c.data as SheetData
  if (src === 'prof') return Math.max(1, d.proficiency ?? 1)
  if (src === 'level') return c.level ?? 1
  if (src === 'fear') return fear
  const t = src === 'spellcast' ? spellcastTrait(d) : src
  return t ? traitValue(d, t as TraitKey) : 0
}
export const SOURCE_IT: Record<string, string> = {
  prof: 'Competenza', level: 'livello', fear: 'Paura del GM', spellcast: 'tratto da incantatore',
  agility: 'Agilità', strength: 'Forza', finesse: 'Finezza', instinct: 'Istinto', presence: 'Presenza', knowledge: 'Conoscenza',
}

/** Dadi effettivi di un danno o di un tiro libero. `times` moltiplica tutto (costo scelto). */
export function diceSpec(formula: string, opts: { count?: number; times?: number } = {}) {
  const m = formula.replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i)
  if (!m) {
    const flat = parseInt(formula, 10)
    return Number.isFinite(flat) ? { groups: [], bonus: flat * (opts.times ?? 1) } : null
  }
  const t = Math.max(1, opts.times ?? 1)
  const n = (opts.count !== undefined ? Math.max(1, opts.count) : parseInt(m[1] || '1', 10)) * t
  return { groups: [{ n, sides: parseInt(m[2], 10) }], bonus: (m[3] ? parseInt(m[3], 10) : 0) * t }
}

export function specText(s: { groups: { n: number; sides: number }[]; bonus: number } | null) {
  if (!s) return ''
  const g = s.groups.map(x => `${x.n}d${x.sides}`).join('+')
  return `${g}${s.bonus ? (s.bonus > 0 && g ? '+' : '') + s.bonus : ''}` || '0'
}

/** Stato di una carta salvato nella scheda: segnalini e usi già fatti. */
export function cardState(c: Character, id: string) {
  return c.data.card_state?.[id] ?? {}
}

/** Perché un'azione non si può usare ora (null se si può). */
export function cannotUse(a: CardAction, c: Character, cardId: string): string | null {
  const st = cardState(c, cardId)
  if (a.per && st.used?.includes(a.id)) return a.per === 'rest' ? 'Già usata: torna al prossimo riposo' : 'Già usata: torna al prossimo riposo lungo'
  if (a.hope && c.hope < a.hope) return `Servono ${a.hope} Speranza`
  if (a.stress && c.stress_marked + a.stress > c.stress_max) return 'Non hai abbastanza Stress libero'
  if (a.armor && c.armor_marked + a.armor > c.armor_max) return 'Non hai slot Armatura liberi'
  const tk = a.tokensFrom ? (cardState(c, a.tokensFrom).tokens ?? 0) : (st.tokens ?? 0)
  if (a.tokens && tk < a.tokens) return a.tokensFrom ? `Servono ${a.tokens} segnalini su «${a.tokensFrom.replace(/^cls:/, '')}»` : 'Non ci sono abbastanza segnalini'
  if (a.scale?.by === 'tokens' && !tk) return a.tokensFrom ? `Nessun segnalino su «${a.tokensFrom.replace(/^cls:/, '')}»` : 'Non ci sono segnalini'
  if (a.scale?.by === 'hope' && c.hope < 1) return 'Serve almeno una Speranza'
  if (a.scale?.by === 'stress' && c.stress_marked >= c.stress_max) return 'Non hai Stress libero'
  return null
}

/** Quante unità al massimo si possono scegliere per un costo variabile. */
export function scaleMax(a: CardAction, c: Character, cardId: string) {
  if (!a.scale) return 1
  const cap = a.scale.max !== undefined ? sourceValue(a.scale.max, c) : 99
  const have = a.scale.by === 'hope' ? c.hope - (a.hope ?? 0)
    : a.scale.by === 'stress' ? c.stress_max - c.stress_marked - (a.stress ?? 0)
    : a.scale.by === 'tokens' ? (cardState(c, a.tokensFrom ?? cardId).tokens ?? 0)
    : 99
  return Math.max(0, Math.min(cap, have))
}

/** Etichetta del pulsante con il costo. */
export function actionCost(a: CardAction) {
  const parts: string[] = []
  if (a.hope) parts.push(`${a.hope} Speranza`)
  if (a.stress) parts.push(`${a.stress} Stress`)
  if (a.armor) parts.push(`${a.armor} Armatura`)
  if (a.tokens) parts.push(`${a.tokens} segnalin${a.tokens === 1 ? 'o' : 'i'}`)
  if (a.scale && a.scale.by !== 'free') parts.push(`${a.scale.by === 'hope' ? 'Speranza' : a.scale.by === 'stress' ? 'Stress' : 'segnalini'} a scelta`)
  return parts.join(' e ')
}

/** Reset degli usi a fine riposo. */
export function resetUses(d: SheetData, kind: 'short' | 'long'): SheetData['card_state'] {
  const out: NonNullable<SheetData['card_state']> = {}
  for (const [id, st] of Object.entries(d.card_state ?? {})) {
    const defs = cardActions(id)
    const used = (st.used ?? []).filter(u => {
      const a = defs.find(x => x.id === u)
      if (!a) return false
      return kind === 'short' ? a.per === 'longRest' : false
    })
    out[id] = { ...st, used }
  }
  return out
}

/** Cosa cambia sulla scheda quando si paga un'azione: risorse, effetti su di sé, segnalini, usi. */
export function cardPatch(c: Character, cardId: string, a: CardAction, n: number): Partial<Character> {
  const by = a.scale?.by
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v))
  const hope = c.hope - (a.hope ?? 0) - (by === 'hope' ? n : 0) + (a.self?.hope ?? 0)
  const stress = c.stress_marked + (a.stress ?? 0) + (by === 'stress' ? n : 0) + (a.self?.stress ?? 0)
  const hp = c.hp_marked + (a.self?.hp ?? 0)
  const armor = c.armor_marked + (a.armor ?? 0) + (a.self?.armor ?? 0)

  const states = c.data.card_state ?? {}
  const st = { ...(states[cardId] ?? {}) }
  let tokens = st.tokens ?? 0
  if (a.fill !== undefined) tokens = Math.max(0, sourceValue(a.fill, c, 0, n, cardId))
  tokens -= (a.tokens ?? 0) + (by === 'tokens' ? n : 0)
  if (a.addTokens) {
    const cap = a.scale?.max !== undefined ? sourceValue(a.scale.max, c, 0, n, cardId) : 99
    tokens = Math.min(cap, tokens + n)
  }
  const spent = (a.tokens ?? 0) + (by === 'tokens' ? n : 0)
  let other: Record<string, { tokens?: number; used?: string[] }> = {}
  if (a.tokensFrom) {
    tokens += spent // i segnalini non si tolgono da questo privilegio…
    const o = states[a.tokensFrom] ?? {}
    other = { [a.tokensFrom]: { ...o, tokens: Math.max(0, (o.tokens ?? 0) - spent) } } // …ma da quello che li tiene
  }
  st.tokens = Math.max(0, tokens)
  if (a.per && !a.exhaustOn) st.used = [...new Set([...(st.used ?? []), a.id])]

  const out: Partial<Character> = { data: { ...c.data, card_state: { ...states, ...other, [cardId]: st } } }
  if (hope !== c.hope) out.hope = Math.max(0, hope)
  if (stress !== c.stress_marked) out.stress_marked = clamp(stress, c.stress_max)
  if (hp !== c.hp_marked) out.hp_marked = clamp(hp, c.hp_max)
  if (armor !== c.armor_marked) out.armor_marked = clamp(armor, c.armor_max)
  return out
}
