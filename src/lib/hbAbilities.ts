/**
 * Abilità degli elementi homebrew: le divido dal testo, le trasformo in azioni giocabili
 * con lo stesso motore delle carte dominio.
 */
import type { HbAbility, Homebrew, SheetData } from './types'
import type { CardAction, CardDef } from './cardEffects'
import { parseBonus, stressUses } from './costs'

const newId = () => Math.random().toString(36).slice(2, 8)

/** Chiave di un'abilità homebrew nel motore delle carte. */
export const hbAbilityKey = (h: Homebrew, a: HbAbility) => `hbab:${h.id}:${a.id}`

/** Riga che fa da titolo: tutta maiuscola (es. "COLPO A BRUCIAPELO") oppure "Nome:" da sola. */
const isTitle = (l: string) => {
  const t = l.trim()
  if (t.length < 3 || t.length > 50) return false
  return (t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t)) || /^[^.!?]{3,40}:$/.test(t)
}
const SMALL = new Set(['a', 'e', 'o', 'di', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'del', 'della', 'dei', 'delle', 'al', 'alla', 'nel', 'nella', 'ed'])
const titleCase = (s: string) => s.toLowerCase().split(' ')
  .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/(^|’|')(\p{L})/gu, (_m, a, b) => a + b.toUpperCase()))).join(' ')

/** Divide un testo in abilità usando i titoli in maiuscolo; propone costi e bonus letti dal testo. */
export function splitAbilities(text: string): HbAbility[] {
  const lines = text.split('\n')
  const out: HbAbility[] = []
  let cur: HbAbility | null = null
  for (const l of lines) {
    if (isTitle(l)) {
      cur = { id: newId(), name: titleCase(l.trim().replace(/:$/, '')), text: '' }
      out.push(cur)
    } else if (cur) cur.text += (cur.text ? '\n' : '') + l
    else if (l.trim()) { cur = { id: newId(), name: 'Abilità', text: l }; out.push(cur) }
  }
  return out.map(a => guess({ ...a, text: a.text.trim() }))
}

/** Costi e bonus proposti leggendo il testo (si possono correggere a mano). */
export function guess(a: HbAbility): HbAbility {
  const t = a.text
  const g: HbAbility = { ...a }
  const st = t.match(/(?:segn|marc)\w* (un|uno|1|due|2) Stress/i)
  if (st) g.stress = /due|2/.test(st[1]) ? 2 : 1
  const hp = t.match(/spend\w* (una|1|due|2) Speranz/i)
  if (hp) g.hope = /due|2/.test(hp[1]) ? 2 : 1
  const b = parseBonus(t)
  if (b?.roll) g.bonusRoll = b.roll
  if (b?.dmg) g.bonusDmg = b.dmg
  if (b?.adv) g.adv = true
  if (/una volta per riposo lungo/i.test(t)) g.per = 'longRest'
  else if (/una volta per riposo/i.test(t)) g.per = 'rest'
  void stressUses
  return g
}

/** Le azioni giocabili di un'abilità homebrew (nessuna se è solo descrittiva). */
export function hbActions(a: HbAbility): CardAction[] {
  const bonus = a.bonusRoll || a.bonusDmg || a.adv
    ? { ...(a.bonusRoll ? { roll: a.bonusRoll } : {}), ...(a.bonusDmg ? { dmg: a.bonusDmg.replace(/^\+/, '') } : {}), ...(a.adv ? { adv: true } : {}) }
    : undefined
  if (!a.hope && !a.stress && !bonus && !a.dice && !a.per) return []
  const what = [bonus?.roll ? `+${bonus.roll} al tiro` : '', bonus?.dmg ? `+${bonus.dmg} ai danni` : '', bonus?.adv ? 'vantaggio' : ''].filter(Boolean).join(', ')
  return [{
    id: 'use',
    label: what || 'Usa',
    hope: a.hope || undefined,
    stress: a.stress || undefined,
    per: a.per,
    bonus,
    dice: a.dice ? { dice: a.dice, label: a.name } : undefined,
  }]
}

/** Definizione per il motore delle carte di un'abilità homebrew del PG. */
export function hbCardDef(d: SheetData | undefined, key: string): CardDef | null {
  const m = key.match(/^hbab:([^:]+):(.+)$/)
  if (!m || !d) return null
  const h = d.homebrew?.find(x => x.id === m[1])
  const a = h?.abilities?.find(x => x.id === m[2])
  return a ? { actions: hbActions(a) } : null
}
