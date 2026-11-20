import type { Character, SheetData, TraitKey } from './types'
import { getArmor, getClass, getWeapon, getSubclass } from '../data'

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
  const texts = [getWeapon(d.primary_weapon_id)?.feature, getWeapon(d.secondary_weapon_id)?.feature, getArmor(d.armor_id)?.feature]
  const total: Record<string, number> = {}
  for (const t of texts) if (t) for (const [k, v] of Object.entries(featureMods(t))) total[k] = (total[k] ?? 0) + (v ?? 0)
  return total
}

export function traitValue(d: SheetData, t: TraitKey) {
  return (d.traits?.[t] ?? 0) + (equipmentMods(d)[t] ?? 0)
}

export function evasion(d: SheetData) {
  const base = getClass(d.class_id)?.evasion ?? 10
  return base + (d.evasion_bonus ?? 0) + (equipmentMods(d).evasion ?? 0)
}

export function armorScore(d: SheetData) {
  return Math.max(0, (getArmor(d.armor_id)?.score ?? 0) + (equipmentMods(d).armor ?? 0))
}

export function thresholds(d: SheetData, level: number): [number, number] {
  const a = getArmor(d.armor_id)
  const base = a ? a.thresholds : [level, level * 2]
  const bonus = level + (d.threshold_bonus ?? 0) + (equipmentMods(d).thresholds ?? 0)
  return a ? [base[0] + bonus, base[1] + bonus] : [base[0] + (d.threshold_bonus ?? 0), base[1] + (d.threshold_bonus ?? 0)]
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
