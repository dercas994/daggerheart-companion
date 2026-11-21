/**
 * Forme Bestiali del Druido (SRD), tradotte.
 * Ogni privilegio può avere azioni giocabili come le carte dominio.
 */
import type { CardAction } from '../lib/cardEffects'
import type { TraitKey } from '../lib/types'
import { use, phyP, weapon } from '../lib/cards/h'

export interface BeastFeature {
  name: string
  text: string
  actions?: CardAction[]
  /** Bonus alle soglie di danno finché si è in questa forma. */
  thresholds?: number
  /** Si esce dalla forma subendo un danno Maggiore o peggiore. */
  fragile?: boolean
}
export interface Beastform {
  id: string
  name: string
  tier: number
  examples: string
  trait?: TraitKey
  traitBonus?: number
  evasion?: number
  /** Attacco: portata, tratto, danno nel formato delle armi ("d8+2 phy"). */
  attack?: { range: string; trait: TraitKey; damage: string }
  advantages: string[]
  features: BeastFeature[]
  /** Forma evoluta (Bestia Leggendaria/Mitica): parte da una forma di rango inferiore. */
  evolved?: { maxTier: number; dmg: number; trait: number; evasion: number; dieUp?: boolean }
  /** Ibrido: forme da cui pescare, quanti vantaggi e privilegi, Stress in più per trasformarsi. */
  hybrid?: { maxTier: number; forms: number; advantages: number; features: number; stress: number }
}

const FRAGILE: BeastFeature = { name: 'Fragile', text: 'Quando subite un danno Maggiore o peggiore, uscite dalla Forma Bestiale.', fragile: true }
const AQUATIC: BeastFeature = { name: 'Acquatico', text: 'Potete respirare e muovervi con naturalezza sott’acqua.' }
const carrier = (n: string): BeastFeature => ({ name: 'Portatore', text: `Quando vi muovete potete portare con voi fino a ${n} alleati consenzienti.` })
const maul = (temp: boolean): BeastFeature => ({
  name: 'Sbranare',
  text: `Quando riuscite in un attacco contro un bersaglio, potete spendere una Speranza per renderlo${temp ? ' temporaneamente' : ''} Vulnerabile e ottenere bonus +1 alla Competenza per questo attacco.`,
  actions: [use({ label: 'Sbrana', hope: 1, bonus: { prof: 1 }, note: 'Il bersaglio diventa Vulnerabile.' }, 'maul')],
})
const birdsEye: BeastFeature = {
  name: 'Vista dall’Alto',
  text: 'Potete volare a volontà. Una volta per riposo, mentre siete in volo, potete fare al GM una domanda sulla scena sotto di voi senza tirare. La prima volta che un personaggio tira per agire su quell’informazione, ha vantaggio.',
  actions: [use({ label: 'Domanda al master', per: 'rest', note: 'Chi agisce per primo su questa informazione tira con vantaggio.' }, 'ask')],
}

export const BEASTFORMS: Beastform[] = [
  // ── Rango 1 ──
  {
    id: 'agile-scout', name: 'Esploratore Agile', tier: 1, examples: 'volpe, topo, donnola…',
    trait: 'agility', traitBonus: 1, evasion: 2, attack: { range: 'Melee', trait: 'agility', damage: 'd4 phy' },
    advantages: ['ingannare', 'localizzare', 'muoversi furtivi'],
    features: [
      { name: 'Agile', text: 'Vi muovete in silenzio e potete spendere una Speranza per muovervi fino a distanza Lontana senza tirare.', actions: [use({ label: 'Corri fino a Lontana', hope: 1 }, 'move')] },
      FRAGILE,
    ],
  },
  {
    id: 'household-friend', name: 'Amico di Casa', tier: 1, examples: 'gatto, cane, coniglio…',
    trait: 'instinct', traitBonus: 1, evasion: 2, attack: { range: 'Melee', trait: 'instinct', damage: 'd6 phy' },
    advantages: ['arrampicarsi', 'localizzare', 'proteggere'],
    features: [
      { name: 'Compagno', text: 'Quando Aiutate un Alleato, potete tirare un d8 come dado vantaggio.', actions: [use({ label: 'Aiuta: d8 vantaggio', dice: { dice: '1d8', label: 'Dado vantaggio' } }, 'help')] },
      FRAGILE,
    ],
  },
  {
    id: 'nimble-grazer', name: 'Erbivoro Agile', tier: 1, examples: 'cervo, gazzella, capra…',
    trait: 'agility', traitBonus: 1, evasion: 3, attack: { range: 'Melee', trait: 'agility', damage: 'd6 phy' },
    advantages: ['saltare', 'muoversi furtivi', 'scattare'],
    features: [
      { name: 'Preda Sfuggente', text: 'Quando un tiro attacco contro di voi riuscirebbe, potete marcare uno Stress e tirare un d4: aggiungete il risultato alla vostra Evasione contro quell’attacco.', actions: [use({ label: 'Schiva', stress: 1, dice: { dice: '1d4', label: '+Evasione' } }, 'dodge')] },
      FRAGILE,
    ],
  },
  {
    id: 'pack-predator', name: 'Predatore di Branco', tier: 1, examples: 'coyote, iena, lupo…',
    trait: 'strength', traitBonus: 2, evasion: 1, attack: { range: 'Melee', trait: 'strength', damage: 'd8+2 phy' },
    advantages: ['attaccare', 'scattare', 'seguire tracce'],
    features: [
      { name: 'Colpo Azzoppante', text: 'Quando riuscite in un attacco contro un bersaglio entro distanza di Mischia, potete marcare uno Stress per renderlo temporaneamente Vulnerabile.', actions: [use({ label: 'Azzoppa', stress: 1, note: 'Il bersaglio è temporaneamente Vulnerabile.' }, 'hobble')] },
      { name: 'Caccia in Branco', text: 'Quando riuscite in un attacco contro lo stesso bersaglio di un alleato che agisce subito prima di voi, aggiungete un d8 al tiro di danno.', actions: [use({ label: '+1d8 ai danni', bonus: { dmg: '1d8' } }, 'pack')] },
    ],
  },
  {
    id: 'aquatic-scout', name: 'Esploratore Acquatico', tier: 1, examples: 'anguilla, pesce, polpo…',
    trait: 'agility', traitBonus: 1, evasion: 2, attack: { range: 'Melee', trait: 'agility', damage: 'd4 phy' },
    advantages: ['orientarsi', 'muoversi furtivi', 'nuotare'],
    features: [AQUATIC, FRAGILE],
  },
  {
    id: 'stalking-arachnid', name: 'Aracnide in Agguato', tier: 1, examples: 'tarantola, ragno lupo…',
    trait: 'finesse', traitBonus: 1, evasion: 2, attack: { range: 'Melee', trait: 'finesse', damage: 'd6+1 phy' },
    advantages: ['attaccare', 'arrampicarsi', 'muoversi furtivi'],
    features: [
      { name: 'Morso Velenoso', text: 'Quando riuscite in un attacco contro un bersaglio entro distanza di Mischia, il bersaglio diventa temporaneamente Avvelenato. Una creatura Avvelenata subisce 1d10 danni fisici diretti ogni volta che agisce.', actions: [use({ label: 'Danno del veleno', damage: { dice: '1d10', type: 'phy' }, note: 'Diretti: ogni volta che il bersaglio Avvelenato agisce.' }, 'poison')] },
      { name: 'Tessitela', text: 'Potete creare una ragnatela robusta, utile sia all’avventura sia in battaglia, che regge una creatura. Potete Trattenere temporaneamente un bersaglio entro distanza Ravvicinata riuscendo in un Tiro Finezza contro di lui.', actions: [{ id: 'web', label: 'Ragnatela', roll: 'finesse', note: 'Se riesci, il bersaglio è temporaneamente Trattenuto.' }] },
    ],
  },
  // ── Rango 2 ──
  {
    id: 'armored-sentry', name: 'Sentinella Corazzata', tier: 2, examples: 'armadillo, pangolino, tartaruga…',
    trait: 'strength', traitBonus: 1, evasion: 1, attack: { range: 'Melee', trait: 'strength', damage: 'd8+2 phy' },
    advantages: ['scavare', 'localizzare', 'proteggere'],
    features: [
      { name: 'Guscio Corazzato', text: 'Il vostro esterno indurito vi dà resistenza ai danni fisici. Inoltre, marcate uno slot Armatura per ritirarvi nel guscio: finché ci restate, i danni fisici si riducono di un valore pari al vostro Punteggio Armatura (dopo la resistenza), ma non potete compiere altre azioni senza uscire da questa forma.', actions: [use({ label: 'Ritirati nel guscio', armor: 1, note: 'Danni fisici dimezzati, poi ridotti del Punteggio Armatura.' }, 'shell')] },
      { name: 'Palla di Cannone', text: 'Marcate uno Stress per farvi lanciare da un alleato contro un avversario. L’alleato effettua un tiro attacco con Agilità o Forza contro un bersaglio entro distanza Ravvicinata. In caso di successo, l’avversario subisce d12+2 danni fisici con la Competenza di chi lancia. Potete spendere una Speranza per colpire un secondo avversario entro distanza Molto Ravvicinata dal primo, che subisce metà dei danni.', actions: [
        use({ label: 'Fatti lanciare', stress: 1, note: 'Tira l’alleato: d12+2 fisici con la sua Competenza.' }, 'cannon'),
        use({ label: 'Secondo bersaglio', hope: 1, note: 'Metà dei danni del primo bersaglio.' }, 'second'),
      ] },
    ],
  },
  {
    id: 'mighty-strider', name: 'Corridore Possente', tier: 2, examples: 'cammello, cavallo, zebra…',
    trait: 'agility', traitBonus: 1, evasion: 2, attack: { range: 'Melee', trait: 'agility', damage: 'd8+1 phy' },
    advantages: ['saltare', 'orientarsi', 'scattare'],
    features: [
      carrier('due'),
      { name: 'Travolgere', text: 'Marcate uno Stress per muovervi fino a distanza Ravvicinata in linea retta ed effettuare un attacco contro tutti i bersagli entro distanza di Mischia dalla linea. I bersagli colpiti subiscono d8+1 danni fisici usando la vostra Competenza e diventano temporaneamente Vulnerabili.', actions: [{ id: 'trample', label: 'Travolgi', roll: 'weapon', stress: 1, damage: phyP('d8+1'), note: 'I bersagli colpiti sono temporaneamente Vulnerabili.' }] },
    ],
  },
  {
    id: 'pouncing-predator', name: 'Predatore in Agguato', tier: 2, examples: 'ghepardo, leone, pantera…',
    trait: 'instinct', traitBonus: 1, evasion: 3, attack: { range: 'Melee', trait: 'instinct', damage: 'd8+6 phy' },
    advantages: ['attaccare', 'arrampicarsi', 'muoversi furtivi'],
    features: [
      { name: 'Rapido', text: 'Spendete una Speranza per muovervi fino a distanza Lontana senza tirare.', actions: [use({ label: 'Corri fino a Lontana', hope: 1 }, 'move')] },
      { name: 'Atterrare', text: 'Marcate uno Stress per portarvi entro distanza di Mischia da un bersaglio ed effettuare un tiro attacco contro di lui. In caso di successo, ottenete bonus +2 alla Competenza per questo attacco e il bersaglio deve marcare uno Stress.', actions: [{ id: 'takedown', label: 'Balza', roll: 'weapon', stress: 1, damage: weapon({ profDelta: 2 }), note: 'Il bersaglio marca uno Stress.' }] },
    ],
  },
  {
    id: 'powerful-beast', name: 'Bestia Potente', tier: 2, examples: 'orso, toro, alce…',
    trait: 'strength', traitBonus: 3, evasion: 1, attack: { range: 'Melee', trait: 'strength', damage: 'd10+4 phy' },
    advantages: ['orientarsi', 'proteggere', 'spaventare'],
    features: [
      { name: 'Furia', text: 'Quando su un dado di danno esce 1, potete tirare un d10 e aggiungerlo al danno. Inoltre, prima di un tiro attacco potete marcare uno Stress per ottenere bonus +1 alla Competenza per quell’attacco.', actions: [
        use({ label: '+1 Competenza', stress: 1, bonus: { prof: 1 } }, 'rage'),
        use({ label: 'd10 per un 1', dice: { dice: '1d10', label: 'Furia' } }, 'one'),
      ] },
      { name: 'Pelle Dura', text: 'Ottenete bonus +2 alle soglie di danno.', thresholds: 2 },
    ],
  },
  {
    id: 'striking-serpent', name: 'Serpente', tier: 2, examples: 'cobra, serpente a sonagli, vipera…',
    trait: 'finesse', traitBonus: 1, evasion: 2, attack: { range: 'Very Close', trait: 'finesse', damage: 'd8+4 phy' },
    advantages: ['arrampicarsi', 'ingannare', 'scattare'],
    features: [
      { name: 'Colpo Velenoso', text: 'Effettuate un attacco contro un numero qualsiasi di bersagli entro distanza Molto Ravvicinata. In caso di successo, il bersaglio è temporaneamente Avvelenato: subisce 1d10 danni fisici diretti ogni volta che agisce.', actions: [
        { id: 'strike', label: 'Colpo Velenoso', roll: 'weapon', note: 'I bersagli colpiti sono temporaneamente Avvelenati.' },
        use({ label: 'Danno del veleno', damage: { dice: '1d10', type: 'phy' }, note: 'Diretti: ogni volta che il bersaglio Avvelenato agisce.' }, 'poison'),
      ] },
      { name: 'Sibilo d’Avvertimento', text: 'Marcate uno Stress per costringere un numero qualsiasi di bersagli entro distanza di Mischia a indietreggiare a distanza Molto Ravvicinata.', actions: [use({ label: 'Sibila', stress: 1 }, 'hiss')] },
    ],
  },
  {
    id: 'winged-beast', name: 'Bestia Alata', tier: 2, examples: 'falco, gufo, corvo…',
    trait: 'finesse', traitBonus: 1, evasion: 3, attack: { range: 'Melee', trait: 'finesse', damage: 'd4+2 phy' },
    advantages: ['ingannare', 'localizzare', 'spaventare'],
    features: [birdsEye, { name: 'Ossa Cave', text: 'Subite penalità −2 alle soglie di danno.', thresholds: -2 }],
  },
  // ── Rango 3 ──
  {
    id: 'legendary-beast', name: 'Bestia Leggendaria', tier: 3, examples: 'una forma di rango 1 potenziata',
    advantages: [], features: [{ name: 'Evoluta', text: 'Scegliete una Forma Bestiale di rango 1 e diventate una versione più grande e potente di quella creatura. Mantenete tutti i suoi tratti e privilegi e ottenete bonus +6 ai tiri di danno, +1 al tratto della forma e +2 all’Evasione.' }],
    evolved: { maxTier: 1, dmg: 6, trait: 1, evasion: 2 },
  },
  {
    id: 'legendary-hybrid', name: 'Ibrido Leggendario', tier: 3, examples: 'grifone, sfinge…',
    trait: 'strength', traitBonus: 2, evasion: 3, attack: { range: 'Melee', trait: 'strength', damage: 'd10+8 phy' },
    advantages: [], features: [{ name: 'Ibrido', text: 'Per trasformarvi marcate uno Stress in più. Scegliete due Forme Bestiali di rango 1–2, poi in tutto quattro vantaggi e due privilegi tra quelle forme.' }],
    hybrid: { maxTier: 2, forms: 2, advantages: 4, features: 2, stress: 1 },
  },
  {
    id: 'mighty-lizard', name: 'Lucertola Possente', tier: 3, examples: 'alligatore, coccodrillo, mostro di Gila…',
    trait: 'instinct', traitBonus: 2, evasion: 1, attack: { range: 'Melee', trait: 'instinct', damage: 'd10+7 phy' },
    advantages: ['attaccare', 'muoversi furtivi', 'seguire tracce'],
    features: [
      { name: 'Difesa Fisica', text: 'Ottenete bonus +3 alle soglie di danno.', thresholds: 3 },
      { name: 'Morsa', text: 'Quando riuscite in un attacco contro un bersaglio entro distanza di Mischia, potete spendere una Speranza per serrarlo tra le fauci, rendendolo temporaneamente Trattenuto e Vulnerabile.', actions: [use({ label: 'Serra le fauci', hope: 1, note: 'Il bersaglio è temporaneamente Trattenuto e Vulnerabile.' }, 'snap')] },
    ],
  },
  {
    id: 'great-predator', name: 'Grande Predatore', tier: 3, examples: 'meta-lupo, velociraptor, tigre dai denti a sciabola…',
    trait: 'strength', traitBonus: 2, evasion: 2, attack: { range: 'Melee', trait: 'strength', damage: 'd12+8 phy' },
    advantages: ['attaccare', 'muoversi furtivi', 'scattare'],
    features: [carrier('due'), maul(true)],
  },
  {
    id: 'great-winged-beast', name: 'Grande Bestia Alata', tier: 3, examples: 'aquila gigante, falcone…',
    trait: 'finesse', traitBonus: 2, evasion: 3, attack: { range: 'Melee', trait: 'finesse', damage: 'd8+6 phy' },
    advantages: ['ingannare', 'distrarre', 'localizzare'],
    features: [birdsEye, carrier('due')],
  },
  {
    id: 'aquatic-predator', name: 'Predatore Acquatico', tier: 3, examples: 'delfino, orca, squalo…',
    trait: 'agility', traitBonus: 2, evasion: 4, attack: { range: 'Melee', trait: 'agility', damage: 'd10+6 phy' },
    advantages: ['attaccare', 'nuotare', 'seguire tracce'],
    features: [AQUATIC, maul(false)],
  },
  // ── Rango 4 ──
  {
    id: 'mythic-beast', name: 'Bestia Mitica', tier: 4, examples: 'una forma di rango 1 o 2 potenziata',
    advantages: [], features: [{ name: 'Evoluta', text: 'Scegliete una Forma Bestiale di rango 1 o 2 e diventate una versione più grande e potente di quella creatura. Mantenete tutti i suoi tratti e privilegi e ottenete bonus +9 ai tiri di danno, +2 al tratto della forma, +3 all’Evasione, e il dado di danno sale di una taglia (d6 diventa d8, d8 diventa d10…).' }],
    evolved: { maxTier: 2, dmg: 9, trait: 2, evasion: 3, dieUp: true },
  },
  {
    id: 'mythic-hybrid', name: 'Ibrido Mitico', tier: 4, examples: 'chimera, coccatrice, manticora…',
    trait: 'strength', traitBonus: 3, evasion: 2, attack: { range: 'Melee', trait: 'strength', damage: 'd12+10 phy' },
    advantages: [], features: [{ name: 'Ibrido', text: 'Per trasformarvi marcate 2 Stress in più. Scegliete tre Forme Bestiali di rango 1–3, poi in tutto cinque vantaggi e tre privilegi tra quelle forme.' }],
    hybrid: { maxTier: 3, forms: 3, advantages: 5, features: 3, stress: 2 },
  },
  {
    id: 'massive-behemoth', name: 'Behemoth', tier: 4, examples: 'elefante, mammut, rinoceronte…',
    trait: 'strength', traitBonus: 3, evasion: 1, attack: { range: 'Melee', trait: 'strength', damage: 'd12+12 phy' },
    advantages: ['localizzare', 'proteggere', 'spaventare', 'scattare'],
    features: [
      carrier('quattro'),
      { name: 'Demolire', text: 'Spendete una Speranza per muovervi fino a distanza Lontana in linea retta ed effettuare un attacco contro tutti i bersagli entro distanza di Mischia dalla linea. I bersagli colpiti subiscono d8+10 danni fisici usando la vostra Competenza e diventano temporaneamente Vulnerabili.', actions: [{ id: 'demolish', label: 'Demolisci', roll: 'weapon', hope: 1, damage: phyP('d8+10'), note: 'I bersagli colpiti sono temporaneamente Vulnerabili.' }] },
      { name: 'Indomito', text: 'Ottenete bonus +2 a tutte le soglie di danno.', thresholds: 2 },
    ],
  },
  {
    id: 'terrible-lizard', name: 'Lucertola Terribile', tier: 4, examples: 'brachiosauro, tirannosauro…',
    trait: 'strength', traitBonus: 3, evasion: 2, attack: { range: 'Melee', trait: 'strength', damage: 'd12+10 phy' },
    advantages: ['attaccare', 'ingannare', 'spaventare', 'seguire tracce'],
    features: [
      { name: 'Colpi Devastanti', text: 'Quando infliggete un danno Grave a un bersaglio entro distanza di Mischia, potete marcare uno Stress per costringerlo a marcare un Punto Ferita aggiuntivo.', actions: [use({ label: '+1 PF al bersaglio', stress: 1 }, 'smash')] },
      { name: 'Passo Colossale', text: 'Potete muovervi fino a distanza Lontana senza tirare. Grazie alla vostra mole ignorate il terreno difficile (a discrezione del GM).' },
    ],
  },
  {
    id: 'mythic-aerial-hunter', name: 'Cacciatore Alato Mitico', tier: 4, examples: 'drago, pterodattilo, roc, viverna…',
    trait: 'finesse', traitBonus: 3, evasion: 4, attack: { range: 'Melee', trait: 'finesse', damage: 'd10+11 phy' },
    advantages: ['attaccare', 'ingannare', 'localizzare', 'orientarsi'],
    features: [
      carrier('tre'),
      { name: 'Rapace Letale', text: 'Potete volare a volontà e muovervi fino a distanza Lontana come parte della vostra azione. Quando vi muovete in linea retta fino a distanza di Mischia da un bersaglio partendo almeno da distanza Ravvicinata e lo attaccate nella stessa azione, potete ritirare tutti i dadi di danno con un risultato inferiore alla vostra Competenza.' },
    ],
  },
  {
    id: 'epic-aquatic-beast', name: 'Bestia Acquatica Epica', tier: 4, examples: 'calamaro gigante, balena…',
    trait: 'agility', traitBonus: 3, evasion: 3, attack: { range: 'Melee', trait: 'agility', damage: 'd10+10 phy' },
    advantages: ['localizzare', 'proteggere', 'spaventare', 'seguire tracce'],
    features: [
      { name: 'Signore degli Oceani', text: 'Potete respirare e muovervi con naturalezza sott’acqua. Quando riuscite in un attacco contro un bersaglio entro distanza di Mischia, potete Trattenerlo temporaneamente.' },
      { name: 'Inflessibile', text: 'Quando stareste per marcare uno slot Armatura, tirate un d6: con 5 o più riducete la gravità di una soglia senza marcare lo slot.', actions: [use({ label: 'Tira il d6', dice: { dice: '1d6', label: 'Inflessibile' }, note: 'Con 5 o più: −1 soglia senza marcare Armatura.' }, 'd6')] },
    ],
  },
]

export const getBeastform = (id?: string) => BEASTFORMS.find(b => b.id === id)
