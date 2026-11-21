// Contenuti di gioco dal Daggerheart SRD 2.0 — Public Game Content secondo la
// Darrington Press Community Gaming License (www.darringtonpress.com/license).
// Testi tradotti in italiano dall'SRD, con la terminologia dell'edizione italiana
// (nomi di carte, privilegi, retaggi). L'originale inglese resta nei campi *_en.
// Il campo `feature` di armi e armature resta in inglese: lo legge rules.ts per i bonus.
import raw from './srd.json'
import { CUSTOM_ANCESTRIES } from './custom'
import type { TraitKey } from '../lib/types'

export interface FeatureMods { armor?: number; thresholds?: number; hp?: number; hope?: number; evasion?: number }
export interface Feature { name: string; text: string; name_it?: string; text_it?: string; mods?: FeatureMods }
export interface Subclass {
  id: string; name: string; description: string; spellcast: TraitKey | null
  foundation: Feature[]; specialization: Feature[]; mastery: Feature[]
}
export interface ClassDef {
  id: string; name: string; description: string; domains: string[]
  evasion: number; hp: number; items: string
  hope_feature: Feature; features: Feature[]; subclasses: Subclass[]
  background_questions: string[]; connections: string[]
}
export interface Heritage { id: string; name: string; description: string; features: Feature[]; custom?: boolean; image?: string; card?: string }
export interface Weapon {
  id: string; name: string; trait: TraitKey | 'spellcast'; range: string; damage: string
  burden: 'One-Handed' | 'Two-Handed'; feature: string; feature_it?: string; name_en?: string; tier: number; category: 'primary' | 'secondary'
  /** Secondo modo d'uso (es. lanciata): portata, tratto e danno propri. */
  alt?: WeaponMode
}
export interface WeaponMode {
  name: string; trait: TraitKey | 'spellcast'; range: string; damage: string
  /** Tiro con svantaggio (-1) o vantaggio (+1) in questo modo. */
  adv?: -1 | 0 | 1
}
/** Armi del manuale che il privilegio rende utilizzabili in due modi. */
const ALT: Record<string, (w: Weapon) => WeaponMode> = {
  javelins: w => ({ name: 'Lanciata', trait: 'agility', range: 'Far', damage: w.damage }),
  'throwing-knives': w => ({ name: 'Lanciata', trait: 'finesse', range: 'Close', damage: w.damage }),
  'improved-throwing-knives': w => ({ name: 'Lanciata', trait: 'finesse', range: 'Close', damage: w.damage }),
  'advanced-throwing-knives': w => ({ name: 'Lanciata', trait: 'finesse', range: 'Close', damage: w.damage }),
  'legendary-throwing-knives': w => ({ name: 'Lanciata', trait: 'finesse', range: 'Close', damage: w.damage }),
  'displacement-razor': w => ({ name: 'A distanza', trait: w.trait, range: 'Very Far', damage: w.damage, adv: -1 }),
}
export interface Armor { id: string; name: string; name_en?: string; thresholds: [number, number]; score: number; feature: string; feature_it?: string; tier: number }
export interface DomainCard {
  id: string; name: string; level: number; domain: string; type: 'spell' | 'ability' | 'grimoire'
  recall: number; text: string; name_it?: string; text_it?: string
}

const data = raw as unknown as {
  classes: ClassDef[]; ancestries: Heritage[]; communities: Heritage[]
  weapons: Weapon[]; armor: Armor[]; cards: DomainCard[]
}

export const CLASSES = data.classes
// retaggi homebrew: sostituiscono quelli SRD con lo stesso id, poi ordine alfabetico (Misto in fondo)
const customIds = new Set(CUSTOM_ANCESTRIES.map(a => a.id))
export const ANCESTRIES: Heritage[] = [
  ...data.ancestries.filter(a => a.id !== 'mixed' && !customIds.has(a.id)),
  ...CUSTOM_ANCESTRIES,
].sort((a, b) => a.name.localeCompare(b.name)).concat(data.ancestries.filter(a => a.id === 'mixed'))
export const COMMUNITIES = data.communities
export const WEAPONS = data.weapons
export const ARMOR = data.armor
export const CARDS = data.cards

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map(x => [x.id, x]))
const classMap = byId(CLASSES), ancMap = byId(ANCESTRIES), comMap = byId(COMMUNITIES)
const weapMap = byId(WEAPONS), armMap = byId(ARMOR), cardMap = byId(CARDS)

export const getClass = (id?: string) => (id ? classMap.get(id) : undefined)
export const getSubclass = (cls?: string, sub?: string) => getClass(cls)?.subclasses.find(s => s.id === sub)
export const getAncestry = (id?: string) => (id ? ancMap.get(id) : undefined)
export const getCommunity = (id?: string) => (id ? comMap.get(id) : undefined)
export const getWeapon = (id?: string): Weapon | undefined => {
  const w = id ? weapMap.get(id) : undefined
  return w && ALT[w.id] ? { ...w, alt: ALT[w.id](w) } : w
}
export const getArmor = (id?: string) => (id ? armMap.get(id) : undefined)
export const getCard = (id?: string) => (id ? cardMap.get(id) : undefined)

export const fname = (f: Feature) => f.name_it || f.name
export const ftext = (f: Feature) => f.text_it || f.text

/** Nomi italiani (edizione italiana) per le voci di interfaccia più usate. */
export const IT = {
  traits: {
    agility: 'Agilità', strength: 'Forza', finesse: 'Astuzia',
    instinct: 'Istinto', presence: 'Presenza', knowledge: 'Conoscenza', spellcast: 'Incantesimi',
  } as Record<string, string>,
  traitVerbs: {
    agility: 'Scattare, Saltare, Destreggiarsi',
    strength: 'Sollevare, Colpire, Afferrare',
    finesse: 'Mantenere il sangue freddo, Nascondersi, Usare uno strumento',
    instinct: 'Percepire, Intuire, Orientarsi',
    presence: 'Affascinare, Esibirsi, Ingannare',
    knowledge: 'Ricordare, Analizzare, Comprendere',
  } as Record<string, string>,
  domains: {
    arcana: 'Arcano', blade: 'Lame', bone: 'Ossa', codex: 'Codice', dread: 'Terrore',
    grace: 'Grazia', midnight: 'Mezzanotte', sage: 'Saggezza', splendor: 'Splendore', valor: 'Valore',
  } as Record<string, string>,
  classes: {
    assassin: 'Assassino', bard: 'Bardo', brawler: 'Lottatore', druid: 'Druido', guardian: 'Guardiano',
    ranger: 'Ranger', rogue: 'Fuorilegge', seraph: 'Consacrato', sorcerer: 'Stregone', warlock: 'Warlock',
    warrior: 'Guerriero', witch: 'Strega', wizard: 'Mago',
  } as Record<string, string>,
  cardType: { spell: 'Incantesimo', ability: 'Capacità', grimoire: 'Grimorio' } as Record<string, string>,
  range: { Melee: 'Mischia', 'Very Close': 'Prossima', Close: 'Ravvicinata', Far: 'Lontana', 'Very Far': 'Remota' } as Record<string, string>,
  burden: { 'One-Handed': 'Una mano', 'Two-Handed': 'Due mani' } as Record<string, string>,
}

/** Colori dei domini: una tinta per riconoscerli a colpo d'occhio sulle carte. */
export const DOMAIN_COLOR: Record<string, string> = {
  arcana: '#7C6BD8', blade: '#C8553D', bone: '#B9AE96', codex: '#3F7CC4', dread: '#6E3A6B',
  grace: '#C9579A', midnight: '#3B3F6B', sage: '#4E9A5B', splendor: '#D8B23A', valor: '#D07A2E',
}

export const className = (id?: string) => (id ? IT.classes[id] ?? getClass(id)?.name ?? id : '')
export const domainName = (id: string) => IT.domains[id] ?? id
export const cardName = (c: DomainCard) => c.name_it || c.name
export const cardText = (c: DomainCard) => c.text_it || c.text
