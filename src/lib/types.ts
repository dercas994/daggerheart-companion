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
export interface HomebrewMods { evasion?: number; armor?: number; thresholds?: number; traits?: Partial<Record<TraitKey, number>> }
/** Contenuto homebrew creato dal giocatore, salvato dentro la scheda. */
/** Modo d'uso alternativo di un'arma homebrew, con il suo eventuale costo. */
export interface HbMode {
  name: string
  trait?: TraitKey
  range?: 'Melee' | 'Very Close' | 'Close' | 'Far' | 'Very Far'
  dice?: string
  damageType?: 'phy' | 'mag'
  /** Danni in più rispetto al dado (es. "1d6"). */
  extra?: string
  stress?: number
  hope?: number
}

/** Abilità di un elemento homebrew, giocabile come le carte. */
export interface HbAbility {
  id: string
  name: string
  text: string
  hope?: number
  stress?: number
  /** Bonus al prossimo tiro: attacco, danno (es. "1d6", "3"), vantaggio. */
  bonusRoll?: number
  bonusDmg?: string
  adv?: boolean
  /** Dadi da tirare (es. riduzione del danno). */
  dice?: string
  per?: 'rest' | 'longRest'
}

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
  /** Vecchio formato del secondo modo d'uso (si legge ancora, si salva in `modes`). */
  alt?: HbMode
  /** Altri modi d'uso dell'arma (fino a 2, oltre al principale): i campi vuoti valgono come il principale. */
  modes?: HbMode[]
  // armatura
  thresholds?: [number, number]
  score?: number
  // capacità e oggetti
  mods?: HomebrewMods
  uses?: number            // caselle d'uso (0 = nessuna)
  used?: number
  quantity?: number
  /** Abilità separate, ognuna con i suoi pulsanti. */
  abilities?: HbAbility[]
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
  /** Stato delle carte dominio giocabili: segnalini e usi «una volta per riposo». */
  card_state?: Record<string, { tokens?: number; used?: string[] }>
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
  /** null per i tiri di danno e i dadi liberi */
  outcome: Outcome | null
  kind?: RollKind
  dice?: { groups: { sides: number; n: number; rolls: number[] }[]; bonus: number; crit_bonus: number } | null
  damage_type?: 'phy' | 'mag' | null
  crit?: boolean
  /** tiro di reazione: niente Speranza né Paura */
  reaction?: boolean
  /** Tiro Combinato: i due tiri condividono group_id; pending finché non si sceglie */
  group_id?: string | null
  pending?: boolean
  effects?: { hope?: Record<string, number>; stress?: Record<string, number>; fear?: number } | null
  /** true se il giocatore ha inserito il risultato di dadi fisici */
  manual?: boolean
  hope_gain?: number | null
  stress_cleared?: number | null
  fear_gain?: number | null
  created_at: string
}

export interface AdversaryFeature {
  name: string
  name_en?: string
  kind: 'passive' | 'action' | 'reaction'
  text: string
  fear?: number
  stress?: number
  /** Bonus che la capacità dà al prossimo tiro (scritto a mano per gli homebrew). */
  bonus_roll?: number
  bonus_dmg?: string
}
/** Scheda di un avversario (dal manuale o creata dal master). */
export interface Adversary {
  id: string
  tier: number
  type: string
  type_it: string
  horde?: number
  name: string
  name_en?: string
  desc: string
  motives: string
  difficulty: number
  thresholds: [number, number] | null
  hp: number
  stress: number
  atk: number | string
  weapon: string
  range: string
  damage: string
  damage_type: 'phy' | 'mag' | string
  experience: string
  features: AdversaryFeature[]
  custom?: boolean
}
export interface EncounterUnit {
  uid: string
  adv: string
  name: string
  hp: number
  stress: number
  defeated: boolean
  note?: string
}
export interface Encounter {
  id: string
  campaign_id: string
  name: string
  units: EncounterUnit[]
  active: boolean
  created_at: string
  updated_at: string
}

export interface Countdown {
  id: string
  campaign_id: string
  name: string
  note: string
  max: number
  value: number
  /** progress = avanzamento dei PG, consequence = minaccia */
  kind: 'progress' | 'consequence'
  visible: boolean
  auto_tick: boolean
  loop: boolean
  sort: number
  created_at: string
  updated_at: string
}
export type CountdownInput = Partial<Pick<Countdown, 'id' | 'name' | 'note' | 'max' | 'value' | 'kind' | 'visible' | 'auto_tick' | 'loop' | 'sort'>>

export interface TagTeam {
  id: string
  campaign_id: string
  initiator_char: string
  initiator_user: string
  partner_char: string | null
  partner_user: string | null
  difficulty: number | null
  status: 'open' | 'joined' | 'resolved' | 'cancelled'
  chosen_roll: string | null
  success: boolean | null
  created_at: string
  updated_at: string
}

export type RollKind = 'duality' | 'damage' | 'dice'
export interface DiceRequest {
  label: string
  groups: { n: number; sides: number }[]
  bonus: number
  kind: 'damage' | 'dice'
  type?: 'phy' | 'mag'
  crit?: boolean
  /** dadi fisici: somma dei dadi letta sul tavolo */
  manualSum?: number
  /** danni di un Tiro Combinato */
  groupId?: string
}

export interface RollRequest {
  modifier: number; label: string; advantage: -1 | 0 | 1
  reaction?: boolean
  /** dadi fisici: valori letti dal tavolo */
  manual?: { hope: number; fear: number; adv?: number }
}

export interface Recap {
  id: string
  campaign_id: string
  number: number | null
  title: string
  played_on: string | null
  body: string
  author_id: string
  created_at: string
  updated_at: string
}

export type MediaKind = 'image' | 'audio'
export interface Media {
  id: string
  campaign_id: string
  kind: MediaKind
  title: string
  album: string
  /** file caricato su Supabase Storage */
  url: string | null
  /** file su Google Drive (condiviso con "chiunque abbia il link") */
  drive_id: string | null
  sort: number
  created_by: string
  created_at: string
}
export type NewMedia = Pick<Media, 'kind' | 'title' | 'album'> & Partial<Pick<Media, 'url' | 'drive_id' | 'sort'>>

export interface RealtimeHandlers {
  onCharacter?: (c: Character) => void
  onCharacterDelete?: (id: string) => void
  onCampaign?: (c: Campaign) => void
  onRoll?: (r: Roll) => void
  onRollDelete?: (id: string) => void
  onRollUpdate?: (r: Roll) => void
  onMembers?: () => void
  onTag?: (t: TagTeam) => void
  onCountdowns?: () => void
  onRecaps?: () => void
  onMedia?: () => void
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
  rollDice(campaignId: string, characterId: string | null, req: DiceRequest): Promise<Roll>
  listEncounters(campaignId: string): Promise<Encounter[]>
  saveEncounter(campaignId: string, e: Partial<Pick<Encounter, 'id' | 'name' | 'units' | 'active'>>): Promise<Encounter>
  deleteEncounter(id: string): Promise<void>
  listCustomAdversaries(): Promise<Adversary[]>
  saveCustomAdversary(a: Adversary): Promise<Adversary>
  deleteCustomAdversary(id: string): Promise<void>

  listCountdowns(campaignId: string): Promise<Countdown[]>
  saveCountdown(campaignId: string, c: CountdownInput): Promise<Countdown>
  deleteCountdown(id: string): Promise<void>

  /** Tiro Combinato su invito */
  getActiveTag(campaignId: string): Promise<TagTeam | null>
  tagOpen(characterId: string): Promise<TagTeam>
  tagJoin(tagId: string, characterId: string): Promise<TagTeam>
  tagCancel(tagId: string): Promise<void>
  tagSetDifficulty(tagId: string, difficulty: number): Promise<void>
  tagRoll(tagId: string, characterId: string, modifier: number, label: string, manual?: { hope: number; fear: number }): Promise<Roll>
  tagResolve(tagId: string, rollId: string): Promise<TagTeam>
  /** Serafino: 3 Speranza per togliere 1 PF a un alleato */
  protectLife(fromId: string, toId: string): Promise<void>
  listRolls(campaignId: string, limit?: number): Promise<Roll[]>
  /** solo master: elimina il tiro e, se revert, toglie Speranza/Paura che aveva dato */
  undoRoll(rollId: string, revert: boolean): Promise<void>
  listRecaps(campaignId: string): Promise<Recap[]>
  saveRecap(campaignId: string, r: Partial<Pick<Recap, 'id' | 'number' | 'title' | 'played_on' | 'body'>>): Promise<Recap>
  deleteRecap(id: string): Promise<void>

  listMedia(campaignId: string): Promise<Media[]>
  addMedia(campaignId: string, items: NewMedia[]): Promise<Media[]>
  updateMedia(id: string, patch: Partial<Pick<Media, 'title' | 'album' | 'sort'>>): Promise<void>
  deleteMedia(m: Media): Promise<void>
  uploadMedia(campaignId: string, file: Blob, name: string): Promise<string>

  subscribe(campaignId: string, h: RealtimeHandlers): () => void
}
