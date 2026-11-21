/** Terrore, Grazia, Mezzanotte, Saggezza. */
import type { CardAction, CardDef } from '../cardEffects'
import { cast, mag, magP, N, phy, phyP, use } from './h'

export const CARDS_B: Record<string, CardAction[] | CardDef> = {
  // ── Terrore ─────────────────────────────────────────────────────────
  'dread-blighting-strike': [
    cast({ damage: magP('d6+1', { onFear: 'd10+1' }), note: 'Il prossimo attacco riuscito del bersaglio fa metà danni. Se fallisci devi spendere una Speranza o segnare uno Stress.' }),
    use({ label: 'Fallito', hope: 1 }, 'missHope'),
    use({ label: 'Fallito', stress: 1 }, 'missStress'),
  ],
  'dread-umbral-veil': {
    tokens: true,
    actions: [
      use({ label: 'Velo d’ombra', stress: 1, per: 'rest', note: 'Metti tanti segnalini quanta Paura ha il GM (usa + sulla carta). Spariscono a fine scena.' }),
      use({ label: '−1 all’attacco subito', tokens: 1 }, 'spend'),
    ],
  },
  'dread-voice-of-dread': [cast({ note: 'Se riesci, la creatura segna uno Stress ed è Trattenuta.' })],
  'dread-hideous-retribution': [cast({ reaction: true, stress: 1, damage: magP('d6'), note: 'Dopo che un alleato subisce danni: se riesci, segni lo Stress e infliggi il danno.' })],
  'dread-siphon-essence': [cast({ per: 'longRest', damage: magP('d12+4'), note: 'Con Paura +1 alla Competenza (attivalo nel tiro dei danni). Togli tanti PF quanti ne ha segnati il bersaglio.' })],
  'dread-shared-trauma': [use({ per: 'rest', note: 'Sposti Punti Ferita tra due creature consenzienti in mischia. ' + N.ally })],
  'dread-terrify': [cast({ dice: { dice: '1d4', label: 'Stress al bersaglio' }, note: 'Il bersaglio segna quello Stress e fugge di una fascia di distanza; con Paura è anche Vulnerabile.' })],
  'dread-chains-of-affliction': [use({ label: 'Incatena', stress: 2, note: 'Chi è colpito dalla creatura Incatenata segna un PF in meno.' })],
  'dread-horror': [use({ label: 'Evoca', stress: 1, damage: mag('d8+1', { count: 'spellcast' }), note: 'Se il bersaglio segna PF, fa un Tiro Reazione (12) o segna altrettanti Stress. Una volta per scena.' })],
  'dread-dire-strike': [use({ label: 'Prosciuga', hope: 1, note: 'Il GM perde una Paura.' })],
  'dread-spectral-mist': [use({ label: 'Lancia', hope: 2, note: 'Tu e gli alleati scelti diventate incorporei: immuni ai danni fisici.' })],
  'dread-darkfire': [use({ label: 'Fuoco Oscuro', scale: { by: 'hope', what: 'Speranze (una per avversario)' }, damage: mag('d8+6', { count: 'spellcast', to: 'a chi fallisce il Tiro Reazione (15); metà a chi riesce' }) })],
  'dread-jump-scare': [use({ label: 'Teletrasporto', stress: 1, note: 'Ti porti in mischia con il bersaglio, che resta Vulnerabile finché non segna PF.' })],
  'dread-dread-touched': [
    use({ label: 'Niente Paura al GM', stress: 2 }, 'nofear'),
    use({ label: '+Paura del GM al tiro', per: 'rest', note: 'Aggiungi al tiro la Paura nella riserva del GM.' }, 'bonus'),
  ],
  'dread-wall-of-hunger': [cast({ difficulty: 10, hope: 1, note: 'Chi è nel muro o lo attraversa segna 2 Stress.' })],
  'dread-dark-army': {
    tokens: true,
    actions: [
      cast({ difficulty: 14, per: 'longRest', fill: 8, note: 'Se fallisci, togli i segnalini.' }),
      use({ label: 'Demoni all’attacco', scale: { by: 'tokens', what: 'segnalini' }, bonusFn: (_c, n) => ({ dmg: `${n}d8` }) }, 'attack'),
      use({ label: 'Demoni di scudo', scale: { by: 'tokens', what: 'segnalini' }, dice: { dice: '1d8', label: 'Danno ridotto di', count: 'scale' } }, 'shield'),
    ],
  },
  'dread-eldritch-flesh': [use({ label: 'Libera 1 Armatura', hope: 2, self: { armor: -1 }, note: 'Dopo un tiro con Paura. Ricorda: +1 alle soglie per ogni Stress segnato.' })],
  'dread-damnation': [cast({ scale: { by: 'stress', what: 'Stress (un d20 ciascuno)' }, damage: mag('d20', { count: 'scale' }), note: 'Se sconfiggi il bersaglio, gli avversari entro distanza Lontana da lui segnano uno Stress.' })],
  'dread-savor-the-anguish': [use({ label: '−1 Stress', self: { stress: -1 }, note: 'Quando un avversario entro distanza Ravvicinata subisce un danno Grave.' })],
  'dread-avatar-of-terror': [
    use({ label: 'Trasformati', stress: 1, note: '+1d6 ai danni per ogni Paura del GM. Prima di ogni tiro azione spendi una Speranza.' }),
    use({ label: 'Resta in forma', hope: 1, note: 'Da pagare prima di ogni tiro azione; se non puoi, torni normale.' }, 'keep'),
  ],
  'dread-invoke-torment': [use({ label: 'Promemoria', note: 'Danni doppi ai bersagli con tutto lo Stress segnato; ne sconfiggi uno così entro Ravvicinata: +1 Speranza.' })],

  // ── Grazia ──────────────────────────────────────────────────────────
  'grace-deft-deceiver': [use({ label: 'Vantaggio per ingannare', hope: 1, bonus: { adv: true } })],
  'grace-enrapture': [
    cast({ note: 'Se riesci, il bersaglio è Rapito.' }),
    use({ label: 'Rapito segna 1 Stress', stress: 1, per: 'rest' }, 'stress'),
  ],
  'grace-inspirational-words': {
    tokens: true,
    actions: [
      use({ label: 'Dopo il riposo lungo', fill: 'presence' }, 'fill'),
      use({ label: 'Ispira un alleato', tokens: 1, note: 'L’alleato toglie uno Stress, oppure un Punto Ferita, oppure guadagna una Speranza: sceglie lui. ' + N.ally }, 'spend'),
    ],
  },
  'grace-tell-no-lies': [cast({ note: 'Se riesci, finché resta entro Ravvicinata non può mentirti.' })],
  'grace-troublemaker': [{ id: 'roll', label: 'Provoca', roll: 'presence', per: 'rest', dice: { dice: '1d4', label: 'Stress al bersaglio', count: 'prof' }, note: 'Se riesci, il bersaglio segna tanti Stress quanto il d4 più alto.' }],
  'grace-hypnotic-shimmer': [cast({ per: 'rest', note: 'Chi colpisci è Stordito e segna uno Stress.' })],
  'grace-invisibility': {
    tokens: true,
    actions: [
      cast({ difficulty: 10, stress: 1, fill: 'spellcast', note: 'Tu o un alleato in mischia diventate Invisibili; ogni sua azione spende un segnalino.' }),
      use({ label: 'Spendi un segnalino', tokens: 1 }, 'spend'),
    ],
  },
  'grace-soothing-speech': [use({ label: 'Conforta', self: { hp: -2 }, note: 'Durante Curare le Ferite su un alleato: lui toglie un PF in più, tu ne togli 2.' })],
  'grace-through-your-eyes': [use({ label: 'Lancia', note: 'Vedi e senti attraverso un bersaglio entro distanza Remota.' })],
  'grace-thought-delver': [
    use({ label: 'Pensieri superficiali', hope: 1 }, 'surface'),
    cast({ note: 'Per scavare a fondo. Con Paura il bersaglio potrebbe accorgersene.' }, 'deep', 'Scava a fondo'),
  ],
  'grace-words-of-discord': [cast({ difficulty: 13, note: 'Il bersaglio segna uno Stress e attacca un altro avversario. La prossima volta su di lui −5 al tiro.' })],
  'grace-never-upstaged': {
    tokens: true,
    actions: [
      use({ label: 'Accumula', stress: 1, scale: { by: 'free', what: 'PF appena segnati' }, addTokens: true }, 'store'),
      use({ label: 'Scarica nel danno', scale: { by: 'tokens', what: 'tutti i segnalini' }, bonusFn: (_c, n) => ({ dmg: String(5 * n) }) }, 'use'),
    ],
  },
  'grace-share-the-burden': [use({ label: 'Prendi lo Stress', per: 'rest', scale: { by: 'free', what: 'Stress da trasferire su di te' }, note: 'Segna su di te lo Stress trasferito e guadagna una Speranza per ognuno; l’alleato lo toglie. ' + N.ally })],
  'grace-endless-charisma': [use({ label: 'Ritira un dado', hope: 1 })],
  'grace-grace-touched': [use({ label: 'Promemoria', note: 'Con 4 carte Grazia: puoi segnare uno slot Armatura al posto di uno Stress, e far segnare Stress al posto di PF.' })],
  'grace-astral-projection': [use({ label: 'Proietta', stress: 1, per: 'longRest' })],
  'grace-mass-enrapture': [cast({ note: 'Chi colpisci è Rapito.' }), use({ label: 'Tutti i Rapiti segnano Stress', stress: 1, note: 'L’incantesimo termina.' }, 'stress')],
  'grace-copycat': [use({ label: 'Imita', per: 'longRest', scale: { by: 'hope', what: 'Speranze (metà del livello della carta)' } })],
  'grace-encore': [cast({ note: 'Se riesci, infliggi lo stesso danno dell’alleato. Con Paura la carta va nel Rifugio.' })],
  'grace-notorious': [use({ label: '+10 al tiro', stress: 1, bonus: { roll: 10 }, note: 'Quando sfrutti la tua fama.' })],

  // ── Mezzanotte ──────────────────────────────────────────────────────
  'midnight-rain-of-blades': [cast({
    hope: 1,
    damage: magP('d8+2', { to: 'a tutti i bersagli colpiti entro distanza Prossima' }),
    extras: [{ label: 'Bersaglio Vulnerabile: +1d8', dice: '1d8', type: 'mag' }],
    note: 'Il master ti dice contro quali bersagli il tiro ha successo: tira i danni una volta e applicali a tutti.',
  })],
  'midnight-uncanny-disguise': {
    tokens: true,
    actions: [
      use({ label: 'Travestiti', stress: 1, fill: 'spellcast', note: 'Ogni azione da travestito spende un segnalino.' }),
      use({ label: 'Spendi un segnalino', tokens: 1 }, 'spend'),
    ],
  },
  'midnight-midnight-spirit': [
    use({ label: 'Evoca', hope: 1 }, 'summon'),
    cast({ damage: mag('d6', { count: 'spellcast' }), note: 'Lo spirito attacca un bersaglio entro distanza Remota, poi svanisce.' }, 'attack', 'Attacca'),
  ],
  'midnight-shadowbind': [cast({ note: 'Gli avversari colpiti entro Prossima sono Trattenuti.' })],
  'midnight-chokehold': [use({ label: 'Strangola', stress: 1, note: 'Il bersaglio è Vulnerabile; chi lo attacca fa 2d6 danni in più.' }), use({ label: '+2d6 ai danni', bonus: { dmg: '2d6' } }, 'dmg')],
  'midnight-veil-of-night': [cast({ difficulty: 13, note: 'Dall’altro lato della cortina sei Nascosto e attacchi con vantaggio.' })],
  'midnight-stealth-expertise': [use({ label: 'Trasforma in Speranza', stress: 1 })],
  'midnight-glyph-of-nightfall': [cast({ hope: 1, note: 'Se riesci, la Difficoltà del bersaglio cala della tua Conoscenza (minimo 1).' })],
  'midnight-hush': [cast({ hope: 1, note: 'Il bersaglio e chi gli sta entro Prossima sono Silenziati.' })],
  'midnight-phantom-retreat': [use({ label: 'Attiva', hope: 1 }, 'set'), use({ label: 'Ritirati', hope: 1 }, 'go')],
  'midnight-dark-whispers': [cast({ stress: 1, note: 'Se riesci, fai al master una delle domande della carta.' })],
  'midnight-mass-disguise': [use({ label: 'Travestimento di Massa', stress: 1, note: 'Attiva un Conto alla rovescia (8) con il master.' })],
  'midnight-midnight-touched': [
    use({ label: '+1 Speranza invece della Paura', per: 'rest', self: { hope: 1 } }, 'hope'),
    use({ label: '+Dado Paura ai danni', stress: 1, note: 'Aggiungi al danno il risultato del Dado Paura del tiro.' }, 'dmg'),
  ],
  'midnight-vanishing-dodge': [use({ label: 'Svanisci', hope: 1, note: 'Diventi Nascosto e ti teletrasporti entro distanza Ravvicinata dall’attaccante.' })],
  'midnight-shadowhunter': [use({ label: 'Nell’ombra', bonus: { adv: true }, note: 'Nella penombra: +1 all’Evasione e attacchi con vantaggio.' })],
  'midnight-spellcharge': {
    tokens: true,
    actions: [
      use({ label: 'Carica', scale: { by: 'free', what: 'PF segnati da danni magici', max: 'spellcast' }, addTokens: true }, 'charge'),
      use({ label: 'Scarica nel danno', scale: { by: 'tokens', what: 'segnalini' }, bonusFn: (_c, n) => ({ dmg: `${n}d6` }) }, 'use'),
    ],
  },
  'midnight-night-terror': [use({ label: 'Terrore', per: 'longRest', scale: { by: 'free', what: 'Paure rubate al GM' }, damage: mag('d6', { count: 'scale', to: 'a ogni bersaglio Atterrito' }), note: 'Chi fallisce il Tiro Reazione (16) è Atterrito e Vulnerabile. Il GM perde le Paure rubate.' })],
  'midnight-twilight-toll': {
    tokens: true,
    actions: [
      use({ label: '+1 segnalino', scale: { by: 'free', what: 'segnalini' }, addTokens: true }, 'add'),
      use({ label: 'Scarica nel danno', scale: { by: 'tokens', what: 'segnalini' }, bonusFn: (_c, n) => ({ dmg: `${n}d12` }) }, 'use'),
    ],
  },
  'midnight-eclipse': [cast({ difficulty: 16, per: 'longRest', note: 'Attacchi contro di voi nell’ombra con svantaggio; un vostro successo con Speranza fa segnare uno Stress.' })],
  'midnight-specter-of-the-dark': [use({ label: 'Diventa Spettrale', stress: 1 })],

  // ── Saggezza ────────────────────────────────────────────────────────
  'sage-gifted-tracker': [use({ label: 'Domande sulle tracce', scale: { by: 'hope', what: 'Speranze (una per domanda)' }, note: 'Contro le creature seguite hai +1 all’Evasione.' })],
  'sage-nature-s-tongue': [
    { id: 'talk', label: 'Parla con la natura', roll: 'instinct', difficulty: 12 },
    use({ label: '+2 al Tiro Incantesimo', hope: 1, bonus: { roll: 2 }, note: 'In un ambiente naturale.' }, 'bonus'),
  ],
  'sage-vicious-entangle': [cast({ damage: phy('1d8+1'), note: 'Il bersaglio è Trattenuto.' }), use({ label: 'Trattieni un altro', hope: 1 }, 'extra')],
  'sage-conjure-swarm': [
    use({ label: 'Scarabei', stress: 1, note: 'Il prossimo danno che subisci scende di una soglia.' }, 'beetles'),
    use({ label: 'Mantieni gli scarabei', hope: 1 }, 'keep'),
    cast({ hope: 1, damage: mag('2d8+3'), note: N.gm }, 'flies', 'Lucciole'),
  ],
  'sage-natural-familiar': [
    use({ label: 'Evoca', hope: 1 }, 'summon'),
    use({ label: 'Famiglio volante', hope: 1 }, 'fly'),
    use({ label: '+1d6 ai danni', bonus: { dmg: '1d6' }, note: 'Contro un avversario in mischia con il famiglio.' }, 'dmg'),
    use({ label: 'Guarda con i suoi occhi', stress: 1 }, 'eyes'),
  ],
  'sage-corrosive-projectile': [cast({ damage: magP('d6+4') }), use({ label: 'Corrodi', stress: 2, note: 'Il bersaglio ha −1 alla Difficoltà ogni 2 Stress spesi.' }, 'corrode')],
  'sage-towering-stalk': [use({ label: 'Evoca lo stelo', per: 'rest' }, 'stalk'), cast({ stress: 1, damage: phyP('d8') }, 'attack', 'Attacca')],
  'sage-death-grip': [cast({ note: 'Scegli: trascinare, stritolare (2 Stress al bersaglio) o colpire chi è in mezzo (Reazione 13, 3d6+2 fisici). Il bersaglio è Trattenuto.', extras: [{ label: 'Chi è in mezzo: 3d6+2', dice: '3d6+2', type: 'phy' }] })],
  'sage-healing-field': [
    use({ label: 'Prato', per: 'longRest', self: { hp: -1 }, note: 'Anche gli alleati entro Ravvicinata tolgono un PF. ' + N.ally }, 'field'),
    use({ label: 'Prato potenziato', hope: 2, per: 'longRest', self: { hp: -2 }, note: 'Anche gli alleati entro Ravvicinata tolgono 2 PF. ' + N.ally }, 'big'),
  ],
  'sage-thorn-skin': {
    tokens: true,
    actions: [
      use({ label: 'Spine', hope: 1, per: 'rest', fill: 'spellcast' }),
      use({ label: 'Riduci il danno', scale: { by: 'tokens', what: 'segnalini' }, dice: { dice: '1d6', label: 'Danno ridotto di', count: 'scale' }, note: 'Se sei in mischia con l’attaccante, gli infliggi lo stesso valore.' }, 'reduce'),
    ],
  },
  'sage-wild-fortress': [cast({ difficulty: 13, hope: 2, note: 'Una cupola con soglie 15/30 che regge 3 PF.' })],
  'sage-conjured-steeds': [use({ label: 'Evoca', scale: { by: 'hope', what: 'Speranze (una per cavalcatura)' }, note: 'In sella: −2 agli attacchi e +2 ai danni.' })],
  'sage-forager': [use({ label: 'Foraggia', dice: { dice: '1d6', label: 'Raccolto' }, note: '1 cibo raro (−2 Stress), 2 reliquia (+2 Speranza), 3 runa (+2 Tiro Incantesimo), 4 fiala (−2 PF), 5 portafortuna (ritira un dado), 6 a scelta.' })],
  'sage-sage-touched': [use({ label: 'Raddoppia il tratto', per: 'rest', note: 'Raddoppi Agilità o Istinto in un tiro. In natura +2 ai Tiri Incantesimo.' })],
  'sage-wild-surge': [use({ label: 'Impeto', stress: 1, per: 'longRest', note: 'Il Dado dell’Impeto parte da 1 e sale a ogni tiro azione: aggiungilo nel campo «Altro».' })],
  'sage-forest-sprites': [cast({ difficulty: 13, scale: { by: 'hope', what: 'Speranze (una per spirito)' } })],
  'sage-rejuvenation-barrier': [cast({ difficulty: 15, per: 'rest', dice: { dice: '1d4', label: 'PF rimossi' }, note: 'Tu e gli alleati dentro togliete quei PF: toglili dalla tua scheda. ' + N.ally })],
  'sage-fane-of-the-wilds': {
    tokens: true,
    actions: [
      use({ label: 'Dopo il riposo lungo', scale: { by: 'free', what: 'carte Saggezza in dotazione e Rifugio' }, addTokens: true }, 'fill'),
      use({ label: 'Bonus al Tiro Incantesimo', scale: { by: 'tokens', what: 'segnalini' }, bonusFn: (_c, n) => ({ roll: n }) }, 'use'),
    ],
  },
  'sage-plant-dominion': [cast({ difficulty: 18, per: 'longRest' })],
  'sage-force-of-nature': [
    use({ label: 'Trasformati', stress: 1, note: '+10 ai danni; prima di ogni tiro azione spendi una Speranza.' }),
    use({ label: '+10 ai danni', bonus: { dmg: '10' } }, 'dmg'),
    use({ label: 'Resta in forma', hope: 1, note: 'Da pagare prima di ogni tiro azione; se non puoi, torni normale.' }, 'keep'),
  ],
  'sage-tempest': [
    cast({ damage: mag('2d20+8'), note: 'I bersagli sono Vulnerabili.' }, 'blizzard', 'Tormenta'),
    cast({ damage: mag('3d10+10'), note: 'Scegli la direzione del vento.' }, 'hurricane', 'Uragano'),
    cast({ damage: mag('5d6+9'), note: 'Attacchi oltre la mischia con svantaggio.' }, 'sand', 'Tempesta di Sabbia'),
  ],
}
