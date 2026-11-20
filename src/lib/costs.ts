/**
 * Riconosce nei testi delle capacità i costi in Stress e il bonus che comprano,
 * così un pulsante può segnare lo Stress e caricare il bonus sul prossimo tiro.
 */

/** Bonus caricato sul prossimo tiro (attacco o danno). */
export interface PendingBonus {
  src: string
  /** Bonus fisso al tiro d'attacco / di dualità. */
  roll?: number
  /** Attacco con vantaggio. */
  adv?: boolean
  /** Dadi o numero in più sul danno, es. "1d6", "4". */
  dmg?: string
  /** +N alla Competenza: un dado arma in più per punto. */
  prof?: number
  /** Danno extra pari ai PF che l'avversario ha segnato. */
  dmgFromHp?: boolean
}

export interface StressUse {
  stress: number
  /** Cosa compra lo Stress, già tagliato alla frase. */
  what: string
  bonus: Omit<PendingBonus, 'src'> | null
}

const NUM: Record<string, number> = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4 }
const toNum = (s: string) => NUM[s.toLowerCase()] ?? (parseInt(s, 10) || 1)
const dice = (s: string) => (/^d/i.test(s) ? `1${s}` : s).replace(/−|–/g, '-')

/** Cerca un bonus al tiro dentro una frase. null se la frase non ne compra uno. */
export function parseBonus(t: string): Omit<PendingBonus, 'src'> | null {
  const b: Omit<PendingBonus, 'src'> = {}
  let m: RegExpMatchArray | null
  if ((m = t.match(/bonus \+(\d+) (?:al risultato|ai tiri d'attacco|ai tiri attacco|al tiro attacco|al tiro)/i))) b.roll = +m[1]
  else if ((m = t.match(/(?:ottiene|ottenete|ottenere|con) \+(\d+) (?:al|ai) tir[oi] (?:d')?attacco/i))) b.roll = +m[1]
  if (/(?:attacco|attacca|attaccare)[^.]*con vantaggio|con vantaggio[^.]*attacc/i.test(t)) b.adv = true
  if ((m = t.match(/\+1 alla Competenza/i))) b.prof = 1
  if ((m = t.match(/aggiungere (?:un |il )?(\d*d\d+) al tiro( di danno)?/i)) && (m[2] || /dann/i.test(t))) b.dmg = dice(m[1])
  else if ((m = t.match(/(\d*d\d+(?:[+−-]\d+)?) danni (?:\w+ )?(?:aggiuntivi|extra|in più)/i))) b.dmg = dice(m[1])
  else if ((m = t.match(/(?:^|[\s(])(\d+) danni (?:\w+ )?(?:aggiuntivi|extra|in più)/i))) b.dmg = m[1]
  else if ((m = t.match(/(?:^|[\s(])\+(\d*d?\d+) (?:ai |al |di )?(?:tir[oi] di )?dann/i))) b.dmg = dice(m[1])
  if (/bonus al tiro di danno pari ai PF che/i.test(t)) b.dmgFromHp = true
  return Object.keys(b).length ? b : null
}

/** Usi volontari di Stress in un testo da PG ("potete marcare uno Stress per…"). */
export function stressUses(text: string): StressUse[] {
  const out: StressUse[] = []
  const re = /potete (?:anche )?(?:marcare|segnare) (un|uno|due|tre|\d+) Stress([^.\n]*)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    // la frase intera, per leggere anche il "quando…" che precede
    const start = Math.max(text.lastIndexOf('.', m.index), text.lastIndexOf('\n', m.index)) + 1
    const end = m.index + m[0].length
    const sentence = text.slice(start, end).trim()
    const what = m[2].replace(/^\s*(?:per|e)\s+/i, '').trim()
    out.push({ stress: toNum(m[1]), what: what || sentence, bonus: parseBonus(sentence) })
  }
  return out
}

/** Danno proprio di una capacità d'attacco ("…infliggete 3d4+10 danni fisici"). */
export function featureDamage(text: string): { dice: string; type: 'phy' | 'mag' } | null {
  if (!/attacc/i.test(text)) return null
  const m = text.match(/infligg(?:e|ete|ono|ere)\s+(\d+d\d+(?:\s*[+−-]\s*\d+)?)\s+danni\s+(fisici|magici)/i)
  if (!m) return null
  return { dice: dice(m[1].replace(/\s+/g, '')), type: m[2].toLowerCase() === 'magici' ? 'mag' : 'phy' }
}

/** Testo breve del bonus, per i pulsanti e per l'etichetta del tiro. */
export function bonusText(b: Omit<PendingBonus, 'src'>, hpMarked = 0) {
  const parts: string[] = []
  if (b.roll) parts.push(`+${b.roll} al tiro`)
  if (b.adv) parts.push('vantaggio')
  if (b.prof) parts.push(`+${b.prof} Competenza`)
  if (b.dmg) parts.push(`+${b.dmg} danni`)
  if (b.dmgFromHp) parts.push(`+${hpMarked} danni`)
  return parts.join(', ')
}

/** Costo di una capacità d'avversario: i campi espliciti, altrimenti letto dal testo. */
export function featureCosts(f: { text: string; fear?: number; stress?: number }) {
  const st = f.stress ?? (f.text.match(/(?:^|[.:]\s*|\bpotete |\be )(?:marcate|marcare|segnate|segnare) (un|uno|due|tre|\d+) Stress/i)?.[1])
  const fe = f.fear ?? (f.text.match(/(?:^|[.:]\s*|\bpotete |\be )(?:spendete|spendere) (un|una|due|tre|\d+) Paur/i)?.[1])
  return {
    stress: typeof st === 'string' ? toNum(st) : st ?? 0,
    fear: typeof fe === 'string' ? toNum(fe) : fe ?? 0,
  }
}

/** Bonus di una capacità d'avversario: quelli scritti a mano nell'editor vincono sul testo. */
export function featureBonus(f: { text: string; bonus_roll?: number; bonus_dmg?: string }): Omit<PendingBonus, 'src'> | null {
  if (f.bonus_roll || f.bonus_dmg) return { ...(f.bonus_roll ? { roll: f.bonus_roll } : {}), ...(f.bonus_dmg ? { dmg: dice(f.bonus_dmg.replace(/^\+/, '')) } : {}) }
  return parseBonus(f.text)
}
