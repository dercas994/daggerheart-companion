/** Forma Bestiale: statistiche effettive della forma in corso. */
import { BEASTFORMS, getBeastform, type BeastFeature, type Beastform } from '../data/beastforms'
import type { Weapon } from '../data'
import type { SheetData, TraitKey, BeastState } from './types'

export interface BeastView {
  name: string
  trait?: TraitKey
  traitBonus: number
  evasion: number
  attack?: { range: string; trait: TraitKey; damage: string }
  advantages: string[]
  /** Privilegi con la chiave per i pulsanti (bf:forma:indice). */
  features: (BeastFeature & { key: string })[]
  thresholds: number
  fragile: boolean
  evo?: TraitKey
}

export const beastKey = (formId: string, i: number) => `bf:${formId}:${i}`
export function beastFeature(key: string): BeastFeature | undefined {
  const [, form, i] = key.split(':')
  return getBeastform(form)?.features[Number(i)]
}
const keyed = (b: Beastform) => b.features.map((f, i) => ({ ...f, key: beastKey(b.id, i) }))

function dieUp(damage: string) {
  return damage.replace(/^d(\d+)/, (_, n) => `d${({ 4: 6, 6: 8, 8: 10, 10: 12 } as Record<string, number>)[n] ?? n}`)
}
function addDmg(damage: string, n: number) {
  const m = damage.match(/^d(\d+)(?:\s*\+\s*(\d+))?\s*(.*)$/)
  return m ? `d${m[1]}+${(m[2] ? parseInt(m[2], 10) : 0) + n} ${m[3]}` : damage
}

/** Forme scegliibili al rango indicato. */
export const beastformsUpTo = (tier: number) => BEASTFORMS.filter(b => b.tier <= tier)

export function beastView(s?: BeastState): BeastView | null {
  const b = getBeastform(s?.id)
  if (!s || !b) return null
  let v: BeastView
  if (b.evolved) {
    const base = getBeastform(s.base)
    if (!base) return null
    const e = b.evolved
    let dmg = base.attack!.damage
    if (e.dieUp) dmg = dieUp(dmg)
    v = {
      name: `${b.name}: ${base.name}`, trait: base.trait, traitBonus: (base.traitBonus ?? 0) + e.trait, evasion: (base.evasion ?? 0) + e.evasion,
      attack: { ...base.attack!, damage: addDmg(dmg, e.dmg) }, advantages: base.advantages,
      features: [...keyed(base), ...keyed(b)], thresholds: 0, fragile: false,
    }
  } else if (b.hybrid) {
    const feats = (s.feats ?? []).map(k => { const f = beastFeature(k); return f ? { ...f, key: k } : null }).filter(Boolean) as BeastView['features']
    v = {
      name: b.name, trait: b.trait, traitBonus: b.traitBonus ?? 0, evasion: b.evasion ?? 0, attack: b.attack,
      advantages: s.advs ?? [], features: [...keyed(b), ...feats], thresholds: 0, fragile: false,
    }
  } else {
    v = { name: b.name, trait: b.trait, traitBonus: b.traitBonus ?? 0, evasion: b.evasion ?? 0, attack: b.attack, advantages: b.advantages, features: keyed(b), thresholds: 0, fragile: false }
  }
  v.thresholds = v.features.reduce((t, f) => t + (f.thresholds ?? 0), 0)
  v.fragile = v.features.some(f => f.fragile)
  v.evo = s.evo
  return v
}

/** Bonus ai tratti/Evasione/soglie dati dalla forma in corso. */
export function beastMods(d: SheetData) {
  const v = beastView(d.beastform)
  const traits: Partial<Record<TraitKey, number>> = {}
  if (!v) return { traits, evasion: 0, thresholds: 0 }
  if (v.trait) traits[v.trait] = v.traitBonus
  if (v.evo) traits[v.evo] = (traits[v.evo] ?? 0) + 1
  return { traits, evasion: v.evasion, thresholds: v.thresholds }
}

/** L'attacco della forma, come arma primaria. */
export function beastWeapon(d: SheetData): Weapon | undefined {
  const v = beastView(d.beastform)
  if (!v?.attack) return undefined
  return { id: 'beast', name: `Attacco di ${v.name.split(': ').pop()}`, trait: v.attack.trait, range: v.attack.range, damage: v.attack.damage, burden: 'Two-Handed', feature: '', tier: 1, category: 'primary' }
}

/** Stress per trasformarsi in questa forma (1 + gli ibridi). */
export const beastStress = (id: string) => 1 + (getBeastform(id)?.hybrid?.stress ?? 0)
