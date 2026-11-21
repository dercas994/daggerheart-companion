import type { Character, Homebrew, SheetData, TraitKey } from './types'
import { getAncestry, getArmor as srdArmor, getClass, getWeapon as srdWeapon, getSubclass, type Armor, type Feature, type FeatureMods, type Weapon } from '../data'

export const HB = 'hb:'
const hbFind = (d: SheetData | undefined, id?: string) => (id?.startsWith(HB) ? d?.homebrew?.find(h => HB + h.id === id) : undefined)

/** Converte un'arma homebrew nel formato delle armi del manuale. */
export function homebrewWeapon(h: Homebrew): Weapon {
  return {
    id: HB + h.id, name: h.name, trait: h.trait ?? 'strength', range: h.range ?? 'Melee',
    damage: `${(h.dice || 'd6').trim()} ${h.damageType ?? 'phy'}`, burden: h.burden ?? 'One-Handed',
    feature: '', feature_it: h.text, tier: 1, category: h.category ?? 'primary',
  }
}
export function homebrewArmor(h: Homebrew): Armor {
  return { id: HB + h.id, name: h.name, thresholds: h.thresholds ?? [5, 11], score: h.score ?? 3, feature: '', feature_it: h.text, tier: 1 }
}
/** Arma o armatura del PG: dal manuale o dal suo homebrew. */
export function getWeapon(id?: string, d?: SheetData): Weapon | undefined {
  const h = hbFind(d, id)
  return h ? (h.kind === 'weapon' ? homebrewWeapon(h) : undefined) : srdWeapon(id)
}
export function getArmor(id?: string, d?: SheetData): Armor | undefined {
  const h = hbFind(d, id)
  return h ? (h.kind === 'armor' ? homebrewArmor(h) : undefined) : srdArmor(id)
}
/** Bonus fissi dati da capacità e oggetti homebrew. */
/** Bonus dell'homebrew: capacità e oggetti sempre, armi e armature solo se equipaggiate. */
export function homebrewMods(d: SheetData) {
  const m = { evasion: 0, armor: 0, thresholds: 0, traits: {} as Partial<Record<TraitKey, number>> }
  const worn = [d.primary_weapon_id, d.secondary_weapon_id, d.armor_id]
  for (const h of d.homebrew ?? []) {
    const active = h.kind === 'ability' || h.kind === 'item' || worn.includes(HB + h.id)
    if (!active) continue
    for (const k of ['evasion', 'armor', 'thresholds'] as const) m[k] += h.mods?.[k] ?? 0
    for (const [t, v] of Object.entries(h.mods?.traits ?? {})) m.traits[t as TraitKey] = (m.traits[t as TraitKey] ?? 0) + (v ?? 0)
  }
  return m
}

/**
 * Carte dominio passive che cambiano i valori della scheda (solo quelle nella dotazione).
 * Le «Padronanza» valgono con 4 o più carte dello stesso dominio in dotazione.
 */
export function cardMods(d: SheetData) {
  const m = { evasion: 0, armor: 0, thresholds: 0, severe: 0, traits: {} as Partial<Record<TraitKey, number>>, bareBones: false }
  const lo = new Set(d.loadout ?? [])
  const count = (dom: string) => (d.loadout ?? []).filter(id => id.startsWith(dom + '-')).length
  const worn = !!getArmor(d.armor_id, d)
  if (lo.has('bone-untouchable')) m.evasion += Math.floor(((d.traits?.agility ?? 0) + (equipmentMods(d).agility ?? 0)) / 2)
  if (lo.has('blade-fortified-armor') && worn) m.thresholds += 2
  if (lo.has('valor-armorer') && worn) m.armor += 1
  if (lo.has('valor-rise-up')) m.severe += Math.max(1, d.proficiency ?? 1)
  if (lo.has('bone-bone-touched') && count('bone') >= 4) m.traits.agility = 1
  if (lo.has('blade-blade-touched') && count('blade') >= 4) m.severe += 4
  if (lo.has('splendor-splendor-touched') && count('splendor') >= 4) m.severe += 3
  if (lo.has('valor-valor-touched') && count('valor') >= 4) m.armor += 1
  if (lo.has('valor-bare-bones') && !worn) m.bareBones = true
  return m
}

/** Le due capacità di retaggio del PG (gestisce anche il retaggio misto). */
export function ancestryFeatures(d: SheetData): Feature[] {
  if (d.ancestry_id === 'mixed') {
    return [getAncestry(d.mixed?.[0])?.features[0], getAncestry(d.mixed?.[1])?.features[1]].filter(Boolean) as Feature[]
  }
  return getAncestry(d.ancestry_id)?.features ?? []
}

/** Bonus fissi dati dal retaggio (carte homebrew con `mods`). */
export function ancestryMods(d: SheetData): Required<FeatureMods> {
  const m = { armor: 0, thresholds: 0, hp: 0, hope: 0, evasion: 0 }
  for (const f of ancestryFeatures(d)) for (const [k, v] of Object.entries(f.mods ?? {})) m[k as keyof typeof m] += v ?? 0
  return m
}

export const hopeMax = (d: SheetData) => d.hope_max ?? 6

export const MAX_HOPE = 6
export const MAX_FEAR = 12
export const MAX_LOADOUT = 5
export const TRAIT_ARRAY = [2, 1, 1, 0, 0, -1]

export const tierOf = (level: number) => (level <= 1 ? 1 : level <= 4 ? 2 : level <= 7 ? 3 : 4)

/** Modificatori di evasione/tratti dati dalle caratteristiche di armi e armature ("−1 to Evasion" ecc.). */
function featureMods(text: string) {
  const mods: Partial<Record<TraitKey | 'evasion' | 'armor' | 'thresholds', number>> = {}
  const re = /([+−-]\d+) to (Evasion|Agility|Strength|Finesse|Instinct|Presence|Knowledge|Armor Score|damage thresholds|all character traits and Evasion)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const n = parseInt(m[1].replace('−', '-'), 10)
    const what = m[2].toLowerCase()
    if (what === 'evasion') mods.evasion = (mods.evasion ?? 0) + n
    else if (what === 'armor score') mods.armor = (mods.armor ?? 0) + n
    else if (what === 'damage thresholds') mods.thresholds = (mods.thresholds ?? 0) + n
    else if (what.startsWith('all character traits')) {
      mods.evasion = (mods.evasion ?? 0) + n
      for (const t of ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'] as TraitKey[]) mods[t] = (mods[t] ?? 0) + n
    } else mods[what as TraitKey] = (mods[what as TraitKey] ?? 0) + n
  }
  return mods
}

export function equipmentMods(d: SheetData) {
  const texts = [getWeapon(d.primary_weapon_id, d)?.feature, getWeapon(d.secondary_weapon_id, d)?.feature, getArmor(d.armor_id, d)?.feature]
  const total: Record<string, number> = {}
  for (const t of texts) if (t) for (const [k, v] of Object.entries(featureMods(t))) total[k] = (total[k] ?? 0) + (v ?? 0)
  return total
}

export function traitValue(d: SheetData, t: TraitKey) {
  return (d.traits?.[t] ?? 0) + (equipmentMods(d)[t] ?? 0) + (homebrewMods(d).traits[t] ?? 0) + (cardMods(d).traits[t] ?? 0)
}

export function evasion(d: SheetData) {
  const base = getClass(d.class_id)?.evasion ?? 10
  return base + (d.evasion_bonus ?? 0) + (equipmentMods(d).evasion ?? 0) + ancestryMods(d).evasion + homebrewMods(d).evasion + cardMods(d).evasion
}

export function armorScore(d: SheetData) {
  const cm = cardMods(d)
  // A Petto Nudo: senza armatura il punteggio base è 3 + Forza
  const base = cm.bareBones ? 3 + traitValue(d, 'strength') : (getArmor(d.armor_id, d)?.score ?? 0)
  return Math.max(0, base + (equipmentMods(d).armor ?? 0) + ancestryMods(d).armor + homebrewMods(d).armor + cm.armor)
}

export function thresholds(d: SheetData, level: number): [number, number] {
  const a = getArmor(d.armor_id, d)
  const cm = cardMods(d)
  const extra = (d.threshold_bonus ?? 0) + (equipmentMods(d).thresholds ?? 0) + ancestryMods(d).thresholds + homebrewMods(d).thresholds + cm.thresholds
  // A Petto Nudo: soglie base per rango
  if (cm.bareBones) {
    const t = ([[9, 19], [11, 24], [13, 31], [15, 38]] as const)[Math.min(3, tierOf(level) - 1)]
    return [t[0] + level + extra, t[1] + level + extra + cm.severe]
  }
  // senza armatura: Maggiore = livello, Grave = 2 × livello
  if (!a) return [level + extra, level * 2 + extra + cm.severe]
  return [a.thresholds[0] + level + extra, a.thresholds[1] + level + extra + cm.severe]
}

/**
 * PF da segnare per un danno. Regola del manuale sui danni massicci:
 * un danno pari ad almeno il doppio della soglia Grave fa segnare 4 PF.
 */
export const massiveThreshold = (sev: number) => sev * 2
export function damageMarks(n: number, maj: number, sev: number) {
  return n <= 0 ? 0 : n >= massiveThreshold(sev) ? 4 : n >= sev ? 3 : n >= maj ? 2 : 1
}

export function spellcastTrait(d: SheetData): TraitKey | null {
  return getSubclass(d.class_id, d.subclass_id)?.spellcast ?? null
}

export const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`.replace('-', '−'))

/** Danno di un'arma con la Competenza: "d8+1 phy" → "2d8+1 fis" */
export function weaponDamage(dmg: string, proficiency: number) {
  const m = dmg.match(/^d(\d+)(?:\s*\+\s*(\d+))?\s*(.*)$/)
  if (!m) return dmg
  const type = m[3].replace('phy/mag', 'fis/mag').replace('phy', 'fis').replace('mag', 'mag')
  return `${proficiency}d${m[1]}${m[2] ? '+' + m[2] : ''} ${type}`
}

/** Dadi di danno dell'arma con la Competenza: "d10+3 phy", competenza 2 → 2d10, +3, fisico. */
export function weaponDamageSpec(dmg: string, proficiency: number): { groups: { n: number; sides: number }[]; bonus: number; type: 'phy' | 'mag' } | null {
  const m = dmg.match(/^d(\d+)(?:\s*\+\s*(\d+))?\s*(.*)$/)
  if (!m) return null
  return { groups: [{ n: Math.max(1, proficiency), sides: parseInt(m[1], 10) }], bonus: m[2] ? parseInt(m[2], 10) : 0, type: /^mag/.test(m[3].trim()) ? 'mag' : 'phy' }
}

/** "2d10 + 1d6 + 3" */
export function diceFormula(groups: { n: number; sides: number }[], bonus: number) {
  const parts = groups.filter(g => g.n > 0).map(g => `${g.n}d${g.sides}`)
  if (bonus) parts.push(String(Math.abs(bonus)))
  return parts.join(' + ').replace(/ \+ (\d+)$/, bonus < 0 ? ' − $1' : ' + $1')
}

export const DAMAGE_TYPE_IT = { phy: 'fisici', mag: 'magici' } as const

export function emptySheet(): SheetData {
  return {
    pronouns: '', class_id: '', subclass_id: '', subclass_tier: 'foundation', ancestry_id: '', community_id: '',
    traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    marked_traits: [], evasion_bonus: 0, threshold_bonus: 0, proficiency: 1,
    experiences: [{ name: '', bonus: 2 }, { name: '', bonus: 2 }],
    primary_weapon_id: '', secondary_weapon_id: '', armor_id: '', inventory_weapon_ids: [],
    inventory: 'Una torcia, 15 metri di corda, provviste di base', gold: { handfuls: 1, bags: 0, chests: 0 },
    loadout: [], vault: [], conditions: [], description: '', background: '', connections: '', notes: '',
    accent: '#E9B949', advancements: [],
  }
}

/** Valori derivati quando si crea/aggiorna il PG (contatori numerici in tabella). */
export function derivedCounters(d: SheetData, prev?: Partial<Character>) {
  const cls = getClass(d.class_id)
  const armorMax = armorScore(d)
  return {
    hp_max: prev?.hp_max ?? cls?.hp ?? 6,
    stress_max: prev?.stress_max ?? 6,
    armor_max: armorMax,
  }
}

export interface Advancement { id: string; label: string; minTier: number; slots: number; cost: number }
export const ADVANCEMENTS: Advancement[] = [
  { id: 'traits', label: '+1 a due tratti non marcati', minTier: 2, slots: 3, cost: 1 },
  { id: 'hp', label: '+1 slot Punti Ferita', minTier: 2, slots: 2, cost: 1 },
  { id: 'stress', label: '+1 slot Stress', minTier: 2, slots: 2, cost: 1 },
  { id: 'experience', label: '+1 a due Esperienze', minTier: 2, slots: 1, cost: 1 },
  { id: 'card', label: 'Una carta dominio aggiuntiva', minTier: 2, slots: 1, cost: 1 },
  { id: 'evasion', label: '+1 Evasione', minTier: 2, slots: 1, cost: 1 },
  { id: 'subclass', label: 'Carta sottoclasse successiva', minTier: 3, slots: 1, cost: 1 },
  { id: 'proficiency', label: '+1 Competenza (vale 2 scelte)', minTier: 2, slots: 1, cost: 2 },
  { id: 'multiclass', label: 'Multiclasse (vale 2 scelte)', minTier: 3, slots: 1, cost: 2 },
]
