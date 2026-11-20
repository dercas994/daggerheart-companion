import type { Adversary, EncounterUnit } from './types'
import { damageMarks } from './rules'

let cache: Promise<Adversary[]> | null = null
/** Il bestiario (≈260 schede) si carica solo quando il master apre lo scontro. */
export function loadBestiary(): Promise<Adversary[]> {
  cache ??= import('../data/adversaries.json').then(m => (m.default ?? m) as unknown as Adversary[])
  return cache
}

/** "1d12+2" → gruppi di dadi e bonus; "2" → solo bonus fisso. */
export function parseDice(s: string): { groups: { n: number; sides: number }[]; bonus: number } {
  const groups: { n: number; sides: number }[] = []
  let bonus = 0
  for (const part of (s || '').replace(/\s+/g, '').replace(/−|–/g, '-').match(/[+-]?[^+-]+/g) ?? []) {
    const m = part.match(/^([+-]?)(\d*)d(\d+)$/)
    if (m) groups.push({ n: parseInt(m[2] || '1', 10) * (m[1] === '-' ? -1 : 1), sides: parseInt(m[3], 10) })
    else if (/^[+-]?\d+$/.test(part)) bonus += parseInt(part, 10)
  }
  return { groups: groups.filter(g => g.n > 0), bonus }
}

/** PF che l'avversario segna per un danno (con danno massiccio). I Seguaci cadono a qualsiasi danno. */
export function adversaryMarks(a: Adversary, dmg: number) {
  if (dmg <= 0) return 0
  if (a.type === 'Minion' || !a.thresholds) return a.hp
  return damageMarks(dmg, a.thresholds[0], a.thresholds[1])
}

/** Seguace (X): ogni X danni ne abbatte un altro. */
export function minionValue(a: Adversary) {
  const f = a.features.find(f => /^Minion|^Seguace/.test(f.name_en ?? f.name))
  const m = f?.name_en?.match(/\((\d+)\)/) ?? f?.name.match(/\((\d+)\)/)
  return m ? parseInt(m[1], 10) : null
}

/** Orda: quando ha segnato metà o più dei PF, l'attacco base cambia danno. */
export function hordeDamage(a: Adversary) {
  const f = a.features.find(f => /^Horde|^Orda/.test(f.name_en ?? f.name))
  const m = (f?.name_en ?? f?.name ?? '').match(/\(([^)]+)\)/)
  return m ? m[1] : null
}

export const RANGE_IT: Record<string, string> = { Melee: 'Mischia', 'Very Close': 'Prossima', Close: 'Ravvicinata', Far: 'Lontana', 'Very Far': 'Remota' }
export const KIND_IT = { passive: 'Passiva', action: 'Azione', reaction: 'Reazione' } as const
export const DMG_IT = (t: string) => (t === 'mag' ? 'mag' : t === 'phy/mag' ? 'fis/mag' : 'fis')

/** Punti battaglia del manuale per costruire uno scontro bilanciato. */
export const BP_COST: Record<string, number> = { Minion: 1, Social: 1, Support: 1, Horde: 2, Ranged: 2, Skulk: 2, Standard: 2, Leader: 3, Bruiser: 4, Solo: 5 }
export function battlePointsSpent(units: EncounterUnit[], byId: (id: string) => Adversary | undefined, party: number) {
  let pts = 0, minions = 0
  for (const u of units) {
    const a = byId(u.adv)
    if (!a) continue
    if (a.type === 'Minion') minions++
    else pts += BP_COST[a.type] ?? 2
  }
  return pts + Math.ceil(minions / Math.max(1, party))
}
export const battleBudget = (party: number) => 3 * party + 2

export const newUid = () => Math.random().toString(36).slice(2, 10)
