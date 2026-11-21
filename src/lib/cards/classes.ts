/**
 * Privilegi di classe e di sottoclasse giocabili.
 * Chiave: "cls:" + nome italiano del privilegio (come compare sulla scheda).
 * Le risorse di classe (Favori, Focus, Dadi Preghiera, Dadi Sterminatore…) sono segnalini del privilegio.
 */
import type { CardAction, CardDef } from '../cardEffects'
import { tierOf } from '../rules'
import { cast, mag, magP, N, strike, use, weapon } from './h'

const tier = (l: number) => tierOf(l)
const FAV = 'cls:Favore'
const FOCUS = 'cls:Postura del Combattente'
const sub = (c: { data: { subclass_id: string; subclass_tier?: string } }, id: string, min: 'foundation' | 'specialization' | 'mastery') => {
  const order = ['foundation', 'specialization', 'mastery']
  return c.data.subclass_id === id && order.indexOf(c.data.subclass_tier ?? 'foundation') >= order.indexOf(min)
}

export const CLASS_FEATURES: Record<string, CardAction[] | CardDef> = {
  // ── Assassino ──
  'cls:Marchiare a Morte': [
    use({ label: 'Marchia il bersaglio', stress: 1, note: 'Un solo avversario Marchiato a Morte alla volta.' }, 'mark'),
    use({ label: 'Danno al Marchiato', bonusFn: c => {
      const die = sub(c, 'executioners-guild', 'mastery') ? 8 : sub(c, 'executioners-guild', 'foundation') ? 6 : 4
      return { dmg: `${tier(c.level)}d${die}` }
    } }, 'dmg'),
  ],
  'cls:Entra & Esci': [use({ label: 'Chiedi la via', hope: 1, bonus: { adv: true }, note: 'Il prossimo tiro che sfrutta l’informazione ha vantaggio.' })],
  'cls:Primo Colpo': [use({ label: 'Primo colpo della scena', note: 'Raddoppia il danno di questo attacco.' })],
  'cls:Colpo Mortale': [use({ label: 'PF in più', stress: 1, note: 'Dopo un danno Grave il bersaglio segna un PF in più.' })],
  'cls:Colpo Preciso': [use({ label: 'Trasforma in successo', hope: 1, per: 'longRest' })],
  'cls:Composti Tossici': {
    tokens: true,
    actions: [
      use({ label: 'Prepara i veleni', stress: 1, dice: { dice: '1d4+1', label: 'Segnalini veleno' }, note: 'Metti sul contatore il risultato.' }, 'brew'),
      use({ label: 'Avvelena', tokens: 1, note: 'Petalo Spettrale: Vulnerabile. Spora del Sepolcro: segna uno Stress. Erba della Sanguisuga: +1d6 danni.' }, 'poison'),
      use({ label: 'Erba della Sanguisuga', tokens: 1, bonus: { dmg: '1d6' } }, 'leech'),
    ],
  },
  'cls:Zanne Gemelle': [use({ label: 'Secondo veleno', note: 'Spendi un segnalino in più da Composti Tossici.' })],

  // ── Bardo ──
  'cls:Chiamata a Raccolta': [
    use({ label: 'Raduna il gruppo', note: 'Tu e ogni alleato ricevete un Dado A Raccolta. Una volta per sessione.' }, 'rally'),
    use({ label: 'Usa il Dado A Raccolta', bonusFn: c => ({ dmg: `1d${c.data.subclass_id === 'wordsmith' && c.data.subclass_tier === 'mastery' ? 10 : c.level >= 5 ? 8 : 6}` }), note: 'Caricato sul prossimo danno. Per un tiro azione o per togliere Stress usa «Tira».' }, 'dmg'),
    use({ label: 'Tira il Dado A Raccolta', dice: { dice: '1d6', label: 'Dado A Raccolta' }, note: 'Aggiungilo a un tiro, oppure togli tanto Stress quanto il risultato. (d8 dal livello 5.)' }, 'roll'),
  ],
  'cls:Musico Eccezionale': [
    use({ label: 'Canzone Popolare', per: 'longRest', self: { hp: -1 }, note: 'Anche gli alleati entro Ravvicinata tolgono un PF. ' + N.ally }, 'folk'),
    use({ label: 'Canto Epico', per: 'longRest', note: 'Un bersaglio entro Ravvicinata è Vulnerabile.' }, 'epic'),
    use({ label: 'Ballata', per: 'longRest', self: { hope: 1 }, note: 'Anche gli alleati entro Ravvicinata guadagnano una Speranza. ' + N.ally }, 'ballad'),
  ],
  'cls:Discorso Ispiratore': [use({ per: 'longRest', note: 'Gli alleati entro Lontana tolgono 2 Stress. ' + N.ally })],
  'cls:Cuore di Poeta': [use({ label: '+1d4 al tiro', hope: 1, dice: { dice: '1d4', label: 'Cuore di Poeta' }, note: 'Aggiungi il risultato al tiro appena fatto.' })],

  // ── Lottatore ──
  'cls:Colpo Combinato': [use({ label: 'Combo', stress: 1, dice: { dice: '1d4', label: 'Dado Combo' }, note: 'Continua a tirare finché l’ultimo risultato non è più basso del precedente: la somma va aggiunta al danno. Se il tuo Dado Combo è cresciuto, tira con «Tira i dadi».' })],
  'cls:Sopraffare': [use({ label: 'Sopraffai', hope: 1, note: 'Scagli il bersaglio entro Ravvicinata o gli fai segnare uno Stress.' })],
  'cls:Circondato': [use({ label: 'Bersagli in più', scale: { by: 'hope', what: 'Speranze (una per creatura in più)' } })],
  'cls:Occhio per Occhio': [use({ label: 'Rendi il colpo', stress: 1, per: 'rest', note: 'L’avversario segna gli stessi PF che hai segnato.' })],
  'cls:Non è Ancora Finita': [use({ label: '+1 Speranza', self: { hope: 1 } }, 'hope'), use({ label: '−1 Stress', self: { stress: -1 } }, 'stress')],
  'cls:Postura del Combattente': { tokens: true, actions: [use({ label: 'Spendi un Focus', tokens: 1, note: 'Usa la scheda Posture Marziali.' })] },
  'cls:Guardia Alta': [use({ label: 'Para', tokens: 1, tokensFrom: FOCUS, bonusFn: () => ({}), note: '+rango all’Evasione contro questo attacco.' })],
  'cls:Cannone Spirituale': [{ id: 'roll', label: 'Cannone', roll: 'instinct', tokens: 1, tokensFrom: FOCUS, damage: magP('d20+3') }],
  'cls:Oltre il Limite': [use({ per: 'rest', self: { hope: 1, stress: -1 } })],

  // ── Druido ──
  'cls:Forma Bestiale': [use({ label: 'Trasformati', stress: 1, note: 'Usa le statistiche della Forma Bestiale scelta.' })],
  'cls:Incarnazione Elementale': [
    use({ label: 'Fuoco', stress: 1, note: 'Chi ti colpisce in mischia subisce 1d10 magici (usa il pulsante).', extras: undefined }, 'fire'),
    use({ label: 'Terra', stress: 1, note: '+Competenza alle soglie finché incanali.' }, 'earth'),
    use({ label: 'Acqua', stress: 1, note: 'Quando ferisci in mischia, gli altri avversari entro Prossima segnano uno Stress.' }, 'water'),
    use({ label: 'Aria', stress: 1, note: 'Ti libri in aria: vantaggio ai Tiri Agilità.' }, 'air'),
    use({ label: 'Fuoco: 1d10 all’attaccante', damage: mag('1d10') }, 'burn'),
  ],
  'cls:Aura Elementale': [use({ per: 'rest', note: 'Fuoco: chi segna PF segna anche Stress. Terra: alleati +1 Forza. Acqua: sposta chi ti colpisce (1 Stress). Aria: −1d8 ai danni a distanza.' }), use({ label: 'Aria: riduci 1d8', dice: { dice: '1d8', label: 'Danno ridotto di' } }, 'air')],
  'cls:Illuminazione della Natura': [use({ per: 'longRest', note: 'Togli tanti Stress quanto il tuo Istinto, divisi tra te e gli alleati.' })],
  'cls:Rigenerazione': [use({ label: 'Rigenera', hope: 3, dice: { dice: '1d4', label: 'PF rimossi' }, note: 'La creatura che tocchi toglie quei PF. ' + N.ally })],
  'cls:Protezione del Guardiano': [use({ label: 'Proteggi', hope: 2, per: 'longRest', dice: { dice: '1d4', label: 'Alleati curati' }, note: 'Quegli alleati tolgono 2 PF. ' + N.ally })],
  'cls:Difensore': [use({ label: 'Riduci di 1 PF', stress: 1, note: 'L’alleato segna un PF in meno.' })],

  // ── Guardiano ──
  'cls:Inarrestabile': {
    tokens: true,
    tokensLabel: 'Dado Inarrestabile',
    tokensMax: c => (c.level >= 5 ? 6 : 4),
    actions: [
      use({ label: 'Diventa Inarrestabile', per: 'longRest', fill: 1, note: 'Il dado parte da 1: si aggiunge da solo ai tuoi tiri di danno e sale di uno dopo ogni danno. I danni fisici che subisci scendono di una soglia (nella finestra «Subisci danno»). Non puoi essere Trattenuto né Vulnerabile.' }),
      use({ label: 'Fine scena', fill: 0 }, 'end'),
    ],
  },
  // carte dominio passive già applicate alla scheda
  'bone-untouchable': { actions: [], passive: '+½ Agilità all’Evasione, già nella scheda.' },
  'blade-fortified-armor': { actions: [], passive: '+2 alle soglie con l’armatura, già nella scheda.' },
  'valor-armorer': { actions: [], passive: '+1 al Punteggio Armatura con l’armatura, già nella scheda.' },
  'valor-bare-bones': { actions: [], passive: 'Senza armatura: Punteggio 3 + Forza e soglie del rango, già nella scheda.' },
  'blade-vitality': { actions: [], passive: 'Scegli i due benefici in Modifica, poi mettila nel Rifugio.' },
  'grace-master-of-the-craft': { actions: [], passive: 'Aggiungi il bonus alle Esperienze in Modifica, poi mettila nel Rifugio.' },
  'midnight-pick-and-pull': [use({ label: 'Vantaggio', bonus: { adv: true }, note: 'Serrature, trappole non magiche, borseggio.' })],
  'bone-on-the-brink': { actions: [], passive: 'Con 2 PF liberi o meno non subisci danni Minori.' },
  'cls:Volontà di Ferro': { actions: [], passive: 'Nella finestra «Subisci danno» puoi segnare 2 slot Armatura contro i danni fisici.' },
  'cls:Saldo': { actions: [], passive: '+1 alle soglie, già nella scheda.' },
  'cls:Implacabile': { actions: [], passive: '+2 alle soglie, già nella scheda.' },
  'cls:Imperturbabile': { actions: [], passive: '+3 alle soglie, già nella scheda.' },
  'cls:Rude': { actions: [], passive: '+3 alla soglia Grave, già nella scheda.' },
  'cls:Ascendente': { actions: [], passive: '+4 alla soglia Grave, già nella scheda.' },
  'cls:Ombra Sfuggente': { actions: [], passive: '+1 all’Evasione, già nella scheda.' },
  "cls:Compagni d'Arme": [use({ label: 'Proteggi l’alleato', armor: 1, note: 'Il danno all’alleato scende di una soglia.' })],
  'cls:Protettore Fedele': [use({ label: 'Subisci al suo posto', stress: 1 })],
  'cls:Vendetta': [use({ label: 'Vendicati', stress: 2, note: 'L’attaccante segna un PF.' })],
  'cls:Rappresaglia': [use({ label: '+1 Competenza', bonus: { prof: 1 }, note: 'Contro l’avversario che ha ferito l’alleato.' })],
  'cls:Nemesi': [use({ label: 'Prendi di Mira', hope: 2 })],

  // ── Ranger ──
  'cls:Focus del Ranger': [strike({ hope: 1, note: 'Se riesci, il bersaglio è il tuo Focus: quando lo ferisci segna uno Stress.' })],
  'cls:Predatore Spietato': [use({ label: '+1 Competenza', stress: 1, bonus: { prof: 1 } })],
  'cls:Amico Fedele': [use({ per: 'longRest', note: 'Tu o il compagno subite il danno al posto dell’altro.' })],
  'cls:Predatore Dominante': [use({ label: 'Prima dell’attacco', hope: 1, note: 'Se l’attacco riesce, il GM perde una Paura.' })],

  // ── Ladro ──
  'cls:Attacco Furtivo': [use({ label: '+d6 furtivi', bonusFn: c => ({ dmg: `${tier(c.level)}d6` }), note: 'Quando sei Ammantato o un alleato è in mischia con il bersaglio.' })],
  "cls:Passo d'Ombra": [use({ label: 'Passo d’ombra', stress: 1 })],
  'cls:Nube di Tenebra': [cast({ difficulty: 15 })],
  'cls:Adrenalina': [use({ label: '+livello ai danni', bonusFn: c => ({ dmg: String(c.level) }), note: 'Finché sei Vulnerabile.' })],
  'cls:Svanire': [use({ label: 'Ammantati', stress: 1 })],
  'cls:Amici Ovunque': [
    use({ label: '+3 a un Dado Dualità', bonus: { roll: 3 } }, 'roll'),
    use({ label: '+2d8 ai danni', bonus: { dmg: '2d8' } }, 'dmg'),
    use({ label: 'Oggetto o oro', note: 'Ti procura 1 manciata d’oro o l’oggetto che serve.' }, 'item'),
  ],

  // ── Serafino ──
  'cls:Dado Preghiera': {
    tokens: true,
    actions: [
      use({ label: 'Tira i Dadi Preghiera', dice: { dice: '1d4', label: 'Dadi Preghiera', count: 'spellcast' }, note: 'Inizio sessione. Metti sul contatore quanti dadi hai e ricordati i valori.' }, 'roll'),
      use({ label: 'Spendi un Dado Preghiera', tokens: 1, note: 'Usa il suo valore per ridurre un danno, aggiungerlo a un tiro o guadagnare altrettante Speranze.' }, 'spend'),
    ],
  },
  'cls:Arma Animata': [use({ label: 'Bersaglio in più', stress: 1 })],
  'cls:Tocco Ristoratore': [use({ per: 'longRest', note: 'Togli 2 PF o 2 Stress alla creatura che tocchi. ' + N.ally })],
  'cls:Ali di Luce': [
    use({ label: 'Trasporta', stress: 1 }, 'carry'),
    use({ label: 'Danni dall’alto', hope: 1, bonusFn: c => ({ dmg: sub(c, 'winged-sentinel', 'mastery') ? '1d12' : '1d8' }) }, 'dmg'),
  ],

  // ── Stregone ──
  'cls:Illusione Minore': [cast({ difficulty: 10 })],
  'cls:Incanalare il Potere Grezzo': [use({ per: 'longRest', note: 'Metti una carta nel Rifugio: guadagni Speranze pari al suo livello, oppure +2×livello al danno di un incantesimo.' })],
  'cls:Elementalista': [use({ label: '+2 al tiro', hope: 1, bonus: { roll: 2 } }, 'roll'), use({ label: '+3 al danno', hope: 1, bonus: { dmg: '3' } }, 'dmg')],
  'cls:Scudo della Natura': [use({ label: 'Difenditi', stress: 1, dice: { dice: '1d6', label: 'Evasione in più' } })],
  'cls:Trascendenza': [use({ per: 'longRest', note: 'Scegli due benefici fino al riposo: +4 soglia Grave, +1 a un tratto, +1 Competenza, +2 Evasione.' })],
  'cls:Manipolare la Magia': [
    use({ label: '+2 al tiro', stress: 1, bonus: { roll: 2 } }, 'roll'),
    use({ label: 'Altro effetto', stress: 1, note: 'Estendi la portata, raddoppia un dado di danno o colpisci un bersaglio in più.' }, 'other'),
  ],
  'cls:Aiuto Incantato': [use({ label: 'Scambia i dadi dell’alleato', per: 'longRest' })],
  'cls:Infusione Arcana': [use({ label: 'Carica', hope: 2 }, 'charge'), use({ label: '+10 ai danni', bonus: { dmg: '10' }, note: 'Consumi la Carica.' }, 'dmg')],

  // ── Warlock ──
  'cls:Favore': {
    tokens: true,
    actions: [
      use({ label: 'Rendi omaggio', scale: { by: 'free', what: 'Favori guadagnati (tratto da incantatore)' }, addTokens: true }, 'tribute'),
      use({ label: '+1 Favore', scale: { by: 'free', what: 'Favori' }, addTokens: true, note: 'Al posto della Speranza di un tiro con Speranza: togli la Speranza con il −.' }, 'gain'),
      use({ label: 'Inizio: 3 Favori', fill: 3 }, 'start'),
    ],
  },
  'cls:Patto del Patrono': [use({ label: 'Invoca il patrono', tokens: 1, tokensFrom: FAV, dice: { dice: '1d6', label: 'Dado del Patrono' }, note: 'Aggiungi il risultato al tiro. Dal livello 5 il dado è un d8: tiralo con «Tira i dadi».' })],
  'cls:Mantello del Patrono': [use({ label: 'Mantello', tokens: 1, tokensFrom: FAV, note: '+rango alle soglie e vantaggio per intimidire, fino a un danno Grave o a fine scena.' })],
  'cls:Abbraccio del Senzamorte': [use({ per: 'rest', scale: { by: 'tokens', what: 'Favori' }, tokensFrom: FAV, dice: { dice: '1d6', label: 'Dadi del Patrono', count: 'scale' }, note: 'Togli un PF per ogni 4 o più.' })],
  'cls:Invocazione Straziante': [use({ label: 'Svantaggio all’attacco', tokens: 1, tokensFrom: FAV, note: 'Se fallisce, l’avversario segna uno Stress.' })],
  'cls:Assorbimento del Danno': [use({ label: 'Dimezza il danno', tokens: 1, tokensFrom: FAV, per: 'rest' })],
  'cls:Egida Oscura': [use({ label: 'Niente PF', tokens: 1, tokensFrom: FAV, per: 'longRest' })],
  'cls:Prosciugare': [use({ label: 'Prosciuga', tokens: 1, tokensFrom: FAV, self: { stress: -1 }, note: 'L’avversario segna uno Stress e tira con un d12 finché non fallisce.' })],
  'cls:Furia del Patrono': [use({ label: 'Furia ai danni', tokens: 1, tokensFrom: FAV, bonusFn: c => ({ dmg: `${tier(c.level)}d${c.level >= 5 ? 8 : 6}` }), note: 'Dura finché non fai un danno Grave: riattiva il bonus per i danni successivi senza spendere (usa «Furia attiva»).' }, 'use'), use({ label: 'Furia attiva', bonusFn: c => ({ dmg: `${tier(c.level)}d${c.level >= 5 ? 8 : 6}` }) }, 'again')],
  'cls:Vendetta Letale': [use({ scale: { by: 'tokens', what: 'Favori (uno per PF segnato)' }, tokensFrom: FAV, dice: { dice: '1d6', label: 'Dadi del Patrono', count: 'scale' }, note: 'L’attaccante segna un PF per ogni 4 o più.' })],
  'cls:Portata Minacciosa': [use({ label: 'Allunga la portata', tokens: 1, tokensFrom: FAV })],
  'cls:Umilia i Miei Nemici': [use({ scale: { by: 'tokens', what: 'Favori (uno Stress ciascuno)' }, tokensFrom: FAV })],
  'cls:Attacco Terrificante': [use({ label: 'Ritira dadi di danno', tokens: 1, tokensFrom: FAV })],
  "cls:Ira dell'Oltremondo": [use({ per: 'rest', scale: { by: 'tokens', what: 'Favori' }, tokensFrom: FAV, dice: { dice: '1d6', label: 'Dadi del Patrono', count: 'scale' }, note: 'Tante creature entro Ravvicinata quanto il risultato più alto segnano un PF.' })],

  // ── Guerriero ──
  'cls:Attacco di Opportunità': [{ id: 'roll', label: 'Reazione', roll: 'weapon', reaction: true, damage: weapon(), note: 'Se riesci scegli un effetto (due con un critico): non si muove, gli infliggi il danno dell’arma, ti muovi con lui.' }],
  'cls:Addestrato al Combattimento': [use({ label: '+livello ai danni fisici', bonusFn: c => ({ dmg: String(c.level) }) })],
  'cls:Coraggio': [use({ label: '+1 Speranza', self: { hope: 1 }, note: 'Dopo un fallimento con Paura.' })],
  'cls:Riti di Battaglia': [use({ per: 'longRest', self: { stress: -2, hope: 2 } })],
  'cls:Sterminatore': {
    tokens: true,
    actions: [
      use({ label: 'Metti un d6', scale: { by: 'free', what: 'dadi', max: 'prof' }, addTokens: true, note: 'Al posto della Speranza di un tiro con Speranza: togline una con il − delle Speranze.' }, 'add'),
      use({ label: 'Usa i Dadi Sterminatore', scale: { by: 'tokens', what: 'dadi' }, bonusFn: (_c, n) => ({ dmg: `${n}d6` }) }, 'use'),
    ],
  },
  'cls:Specialista delle Armi': [use({ label: 'Dado dell’arma secondaria', hope: 1, note: 'Aggiungi un dado di danno dell’arma secondaria.' })],

  // ── Strega ──
  'cls:Maledizione': [use({ label: 'Maledici', stress: 1, note: 'Il bersaglio ha −rango ai danni e alla Difficoltà.' })],
  'cls:Comunione': [use({ per: 'longRest', dice: { dice: '1d6', label: 'Comunione', count: 'spellcast' }, note: 'Scegli un risultato: 1–3 sensazione, 4–5 visione o suoni, 6 una scena vissuta.' })],
  'cls:Talismano Incantato': { tokens: true, actions: [use({ per: 'rest', scale: { by: 'hope', what: 'Speranze' }, addTokens: true }), use({ label: '−1 PF a chi lo tiene', tokens: 1 }, 'spend')] },
  'cls:Camminare Tra i Mondi': { tokens: true, actions: [cast({ difficulty: 13, per: 'rest', stress: 1, fill: 'spellcast' }), use({ label: 'Domanda a uno spirito', tokens: 1 }, 'ask')] },
  'cls:Cerchio di Potere': { tokens: true, actions: [use({ per: 'rest', fill: 'spellcast', note: '+2 a soglie, attacchi ed Evasione nel cerchio.' }), use({ label: 'Togli un segnalino', tokens: 1 }, 'spend')] },
  'cls:Incanto Notturno': [cast({ difficulty: 13 }), use({ label: 'Mantieni l’Incanto', stress: 1 }, 'keep')],
  'cls:Fasi Lunari': [use({ label: 'Tira la fase', dice: { dice: '1d6', label: 'Fase lunare' }, note: '1 Luna Nuova, 2–3 Crescente (+2 danni), 4 Piena (+3 soglie), 5–6 Calante (+1 Evasione).' }, 'roll'), use({ label: 'Sposta la fase', hope: 1, per: 'rest' }, 'shift')],

  // ── Mago ──
  'cls:Segni Misteriosi': [use({ label: '+1 Speranza', self: { hope: 1 } }, 'hope'), use({ label: '−1 Stress', self: { stress: -1 } }, 'stress')],
  'cls:Iniziato': [use({ label: 'Esperienza raddoppiata', stress: 1, note: 'Usi l’Esperienza segnando Stress invece di spendere Speranza, e ne raddoppi il bonus.' })],
  'cls:Padronanza Affinata': [use({ label: 'Esperienza gratis?', dice: { dice: '1d6', label: 'Padronanza Affinata' }, note: 'Con 5 o più usi l’Esperienza senza spendere Speranza.' })],
  'cls:Affronta la Tua Paura': [use({ label: 'Danni extra', bonusFn: c => ({ dmg: sub(c, 'school-of-war', 'mastery') ? '3d10' : sub(c, 'school-of-war', 'specialization') ? '2d10' : '1d10' }), note: 'Dopo un attacco riuscito con Paura.' })],
  'cls:Prosperare nel Caos': [use({ label: 'PF in più', stress: 1 })],
}

