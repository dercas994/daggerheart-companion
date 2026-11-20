export type TraitKey = 'agility' | 'strength' | 'finesse' | 'instinct' | 'presence' | 'knowledge'
export const TRAITS: TraitKey[] = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge']

export interface User { id: string; email: string; display_name: string }

export interface Campaign {
  id: string
  name: string
  description: string
  gm_id: string
  invite_code: string
  fear: number
  created_at: string
}
export interface CampaignWithRole extends Campaign { role: 'gm' | 'player' }

export interface Member { campaign_id: string; user_id: string; role: 'gm' | 'player'; display_name: string }

export interface Experience { name: string; bonus: number }

export type HomebrewKind = 'weapon' | 'armor' | 'ability' | 'item'
export interface HomebrewMods { evasion?: number; armor?: number; thresholds?: number }
/** Contenuto homebrew creato dal giocatore, salvato dentro la scheda. */
export interface Homebrew {
  id: string
  kind: HomebrewKind
  name: string
  text: string
  // arma
  trait?: TraitKey
  range?: 'Melee' | 'Very Close' | 'Close' | 'Far' | 'Very Far'
  dice?: string            // es. "d8+2"
  damageType?: 'phy' | 'mag'
  burden?: 'One-Handed' | 'Two-Handed'
  category?: 'primary' | 'secondary'
  // armatura
  thresholds?: [number, number]
  score?: number
  // capacità e oggetti
  mods?: HomebrewMods
  uses?: number            // caselle d'uso (0 = nessuna)
  used?: number
  quantity?: number
}

export type SubclassTier = 'foundation' | 'specialization' | 'mastery'

export interface SheetData {
  pronouns: string
  class_id: string
  subclass_id: string
  subclass_tier: SubclassTier
  ancestry_id: string
  /** Retaggio misto: [retaggio della prima capacità, retaggio della seconda] */
  mixed?: [string, string]
  community_id: string
  traits: Record<TraitKey, number>
  marked_traits: TraitKey[]
  evasion_bonus: number
  threshold_bonus: number
  proficiency: number
  experiences: Experience[]
  primary_weapon_id: string
  secondary_weapon_id: string
  armor_id: string
  inventory_weapon_ids: string[]
  inventory: string
  gold: { handfuls: number; bags: number; chests: number }
  loadout: string[]
  vault: string[]
  conditions: string[]
  description: string
  background: string
  connections: string
  notes: string
  accent: string
  advancements: { level: number; picks: string[] }[]
  homebrew?: Homebrew[]
  /** URL pubblico del ritratto del PG (Supabase Storage) */
  portrait_url?: string
  /** Slot Speranza (6 di base, alcuni retaggi ne danno di più) */
  hope_max?: number
  multiclass?: { class_id: string; domain: string; subclass_id: string }
}

export interface Character {
  id: string
  campaign_id: string
  owner_id: string
  name: string
  level: number
  hp_max: number
  hp_marked: number
  stress_max: number
  stress_marked: number
  hope: number
  armor_max: number
  armor_marked: number
  data: SheetData
  created_at?: string
  updated_at?: string
}

export type Outcome = 'hope' | 'fear' | 'crit'
export interface Roll {
  id: string
  campaign_id: string
  character_id: string | null
  user_id: string
  roller_name: string
  label: string
  hope_die: number
  fear_die: number
  adv_die: number
  modifier: number
  total: number
  outcome: Outcome
  /** true se il giocatore ha inserito il risultato di dadi fisici */
  manual?: boolean
  created_at: string
}

export interface RollRequest {
  modifier: number; label: string; advantage: -1 | 0 | 1
  /** dadi fisici: valori letti dal tavolo */
  manual?: { hope: number; fear: number; adv?: number }
}

export interface RealtimeHandlers {
  onCharacter?: (c: Character) => void
  onCharacterDelete?: (id: string) => void
  onCampaign?: (c: Campaign) => void
  onRoll?: (r: Roll) => void
  onMembers?: () => void
}

export interface Backend {
  mode: 'supabase' | 'demo'
  getUser(): Promise<User | null>
  onAuthChange(cb: (u: User | null) => void): () => void
  signUp(email: string, password: string, displayName: string): Promise<{ needsConfirm: boolean }>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>

  listMyCampaigns(): Promise<CampaignWithRole[]>
  createCampaign(name: string, description: string): Promise<Campaign>
  joinCampaign(code: string): Promise<Campaign>
  getCampaign(id: string): Promise<Campaign>
  updateCampaign(id: string, patch: Partial<Pick<Campaign, 'name' | 'description' | 'fear'>>): Promise<void>
  deleteCampaign(id: string): Promise<void>
  listMembers(campaignId: string): Promise<Member[]>

  listCharacters(campaignId: string): Promise<Character[]>
  getCharacter(id: string): Promise<Character>
  createCharacter(c: Omit<Character, 'id' | 'owner_id'>): Promise<Character>
  updateCharacter(id: string, patch: Partial<Omit<Character, 'id' | 'campaign_id' | 'owner_id'>>): Promise<Character>
  deleteCharacter(id: string): Promise<void>

  uploadPortrait(campaignId: string, characterId: string, image: Blob): Promise<string>
  deletePortrait(url: string): Promise<void>
  roll(campaignId: string, characterId: string | null, req: RollRequest): Promise<Roll>
  listRolls(campaignId: string, limit?: number): Promise<Roll[]>
  subscribe(campaignId: string, h: RealtimeHandlers): () => void
}
