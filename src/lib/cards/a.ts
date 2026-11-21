/** Arcano, Lama, Ossa, Codice. */
import type { CardAction, CardDef } from '../cardEffects'
import { traitValue } from '../rules'
import { cast, mag, magP, N, phy, phyP, strike, use, weapon } from './h'

export const CARDS_A: Record<string, CardAction[] | CardDef> = {
  // ── Arcano ──────────────────────────────────────────────────────────
  'arcana-rune-ward': [use({ label: 'Riduci il danno', hope: 1, dice: { dice: '1d8', label: 'Danno ridotto di' }, exhaustOn: 8, per: 'rest',
    note: 'Sottrai il risultato dal danno in arrivo. Con un 8 l’amuleto si esaurisce fino al prossimo riposo.' })],
  'arcana-unleash-chaos': [
    use({ label: 'Carica (inizio sessione)', fill: 'spellcast' }, 'fill'),
    cast({ scale: { by: 'tokens', what: 'segnalini da scatenare' }, damage: mag('d10', { count: 'scale' }), note: N.gm }),
    use({ label: 'Ricarica', stress: 1, fill: 'spellcast' }, 'recharge'),
  ],
  'arcana-wall-walk': [use({ label: 'Lancia', hope: 1, note: 'La creatura che tocchi cammina su pareti e soffitti fino a fine scena.' })],
  'arcana-cinder-grasp': [cast({ damage: mag('1d20+3'), extras: [{ label: 'In Fiamme: 2d6', dice: '2d6', type: 'mag' }], note: 'Il bersaglio è In Fiamme: se lo è ancora alla fine di una sua azione, tira «In Fiamme».' })],
  'arcana-floating-eye': [use({ label: 'Lancia', hope: 1, note: 'Vedi attraverso la sfera finché non subisce danni o esce da distanza Remota.' })],
  'arcana-counterspell': [cast({ reaction: true, toVault: true, note: 'Se riesci, l’effetto magico si interrompe e la carta va nel Rifugio.' })],
  'arcana-flight': [
    cast({ difficulty: 15, fill: 'agility', note: 'Se riesci voli: spendi un segnalino a ogni tiro azione. Se fallisci, togli i segnalini.' }),
    use({ label: 'Spendi un segnalino', tokens: 1 }, 'spend'),
  ],
  'arcana-blink-out': [cast({ difficulty: 12, scale: { by: 'hope', what: 'Speranze (1 per te, +1 per ogni creatura che porti)' }, note: 'Ti teletrasporti entro distanza Lontana con chi hai pagato.' })],
  'arcana-preservation-blast': [cast({ damage: mag('d8+3', { count: 'spellcast' }), note: `${N.gm} I bersagli colpiti vengono respinti fino a distanza Lontana.` })],
  'arcana-chain-lightning': [cast({ stress: 2, damage: mag('2d8+4', { to: 'a chi fallisce il tiro reazione' }), note: 'I bersagli colpiti tirano una reazione con Difficoltà pari al tuo risultato; la catena prosegue sugli avversari vicini.' })],
  'arcana-premonition': [use({ per: 'longRest', note: 'Annulli la mossa appena fatta e le sue conseguenze, e ne fai un’altra.' })],
  'arcana-rift-walker': [cast({ difficulty: 15, note: 'La prima volta tracci il simbolo; la successiva apri lo squarcio fino a lì.' })],
  'arcana-telekinesis': [
    cast({ note: 'Se riesci, sposti il bersaglio entro distanza Lontana.' }),
    cast({ damage: phyP('d12+4'), note: 'Scagli il bersaglio sollevato contro un secondo bersaglio; poi l’incantesimo termina.' }, 'hurl', 'Scaglia'),
  ],
  'arcana-arcana-touched': [use({ label: 'Scambia Speranza e Paura', per: 'rest', note: 'Con 4 carte Arcano: scambi i risultati dei due dadi. Ricorda anche +1 ai Tiri Incantesimo.' })],
  'arcana-cloaking-blast': [use({ label: 'Ammantati', hope: 1, note: 'Dopo un Tiro Incantesimo riuscito: restando immobile resti invisibile finché non entri nel campo visivo di un avversario o attacchi.' })],
  'arcana-arcane-reflection': [use({ label: 'Rifletti', scale: { by: 'hope', what: 'Speranze' }, dice: { dice: '1d6', label: 'Riflessione', count: 'scale' }, note: 'Se esce almeno un 6, l’attacco magico torna a chi l’ha lanciato.' })],
  'arcana-confusing-aura': {
    tokens: true,
    actions: [
      cast({ difficulty: 14, per: 'longRest', fill: 1, note: 'Se riesci hai 1 strato d’illusione (un segnalino). Puoi aggiungerne segnando Stress.' }),
      use({ label: 'Strati extra', scale: { by: 'stress', what: 'Stress (uno per strato)' }, addTokens: true }, 'layers'),
      use({ label: 'Mi attaccano', dice: { dice: '1d6', label: 'Strati', count: 'tokens' }, note: 'Con almeno un 5 l’attacco fallisce e togli un segnalino. Con tutti 4 o meno subisci il danno e l’incantesimo termina.' }, 'defend'),
      use({ label: 'Togli uno strato', tokens: 1 }, 'drop'),
    ],
  },
  'arcana-earthquake': [cast({ difficulty: 16, per: 'rest', damage: phy('3d10+8', { to: 'a chi fallisce il Tiro Reazione (18); metà a chi riesce' }), note: 'Chi fallisce è anche Vulnerabile. Il terreno entro distanza Remota diventa difficile.' })],
  'arcana-sensory-projection': [cast({ difficulty: 15, per: 'rest', note: 'Vedi e senti un luogo in cui sei già stato, finché non subisci danni o lanci un altro incantesimo.' })],
  'arcana-adjust-reality': [use({ label: 'Cambia un risultato', hope: 5, note: 'Scegli il nuovo risultato numerico, purché possibile con i dadi tirati.' })],
  'arcana-falling-sky': [cast({ scale: { by: 'stress', what: 'Stress (uno per ogni 1d20+2)' }, damage: mag('1d20+2', { perUnit: true }), note: N.gm })],

  // ── Lama ────────────────────────────────────────────────────────────
  'blade-get-back-up': [use({ label: 'Riduci un danno Grave', stress: 1, note: 'Il danno Grave scende di una soglia.' })],
  'blade-not-good-enough': [use({ label: 'Promemoria', note: 'Nel tiro dei danni ritira tutti gli 1 e i 2.' })],
  'blade-whirlwind': [use({ label: 'Turbine', hope: 1, note: 'Dopo un attacco riuscito entro distanza Prossima: lo stesso attacco vale contro tutti gli altri bersagli entro Prossima; quelli colpiti in più subiscono metà danni.' })],
  'blade-a-soldier-s-bond': [use({ per: 'longRest', self: { hope: 3 }, note: 'Anche la persona a cui fai il complimento guadagna 3 Speranze. ' + N.ally })],
  'blade-reckless': [use({ label: 'Vantaggio all’attacco', stress: 1, bonus: { adv: true } })],
  'blade-scramble': [use({ per: 'rest', note: 'Eviti l’attacco in mischia e ti allontani in sicurezza.' })],
  'blade-versatile-fighter': [use({ label: 'Dado al massimo', stress: 1, note: 'Nel prossimo tiro dei danni un dado vale il suo massimo.' })],
  'blade-deadly-focus': [use({ label: 'Concentrati', per: 'rest', bonus: { prof: 1 }, note: '+1 alla Competenza finché non attacchi un’altra creatura, non sconfiggi il bersaglio o la battaglia non finisce. Il bonus vale per il prossimo danno: riattivalo per i successivi.' })],
  'blade-champion-s-edge': [
    use({ label: 'Togli 1 PF', hope: 1, self: { hp: -1 } }, 'hp'),
    use({ label: 'Libera 1 Armatura', hope: 1, self: { armor: -1 } }, 'armor'),
    use({ label: 'Il bersaglio segna 1 PF', hope: 1, note: 'Dopo un critico: il bersaglio segna un Punto Ferita in più. Ogni opzione una volta sola.' }, 'extra'),
  ],
  'blade-battle-hardened': [use({ label: 'Evita la Mossa Mortale', hope: 1, per: 'longRest', self: { hp: -1 } })],
  'blade-rage-up': [use({ label: 'Infuriati', stress: 1, bonusFn: c => ({ dmg: String(2 * traitValue(c.data, 'strength')) }), note: 'Puoi infuriarti due volte per attacco: i bonus si sommano.' })],
  'blade-blade-touched': [use({ label: 'Promemoria', note: 'Con 4 carte Lama: +2 ai tiri attacco e +4 alla soglia Grave.' })],
  'blade-glancing-blow': [use({ label: 'Danno di striscio', stress: 1, damage: weapon({ halfProf: true }), note: 'Dopo un attacco fallito: infliggi comunque il danno con metà Competenza.' })],
  'blade-battle-cry': [use({ label: 'Grida', per: 'longRest', note: 'Gli alleati che ti sentono tolgono 1 Stress e guadagnano 1 Speranza, e attaccano con vantaggio finché qualcuno non fallisce con Paura. ' + N.ally })],
  'blade-frenzy': [use({ label: 'Frenesia', per: 'longRest', bonus: { dmg: '10' }, note: 'Finché ci sono avversari in vista: niente slot Armatura, +10 ai danni, +8 alla soglia Grave. Il +10 è caricato sul prossimo danno: riattivalo per i successivi.' })],
  'blade-gore-and-glory': [
    use({ label: '+1 Speranza', self: { hope: 1 } }, 'hope'),
    use({ label: '−1 Stress', self: { stress: -1 } }, 'stress'),
  ],
  'blade-reaper-s-strike': [strike({ hope: 1, per: 'longRest', damage: undefined, note: 'Il master ti dice contro chi riusciresti: scegline uno, segna 5 Punti Ferita.' })],
  'blade-battle-monster': [use({ label: 'Mastino', stress: 4, note: 'Dopo un attacco riuscito: il bersaglio segna tanti PF quanti ne hai segnati tu, invece di tirare i danni.' })],
  'blade-onslaught': [use({ label: 'Punisci', stress: 1, note: 'Chi ha colpito l’alleato fa un Tiro Reazione (15): se fallisce segna un PF. Ricorda: i tuoi attacchi riusciti fanno sempre almeno 2 PF.' })],

  // ── Ossa ────────────────────────────────────────────────────────────
  'bone-deft-maneuvers': [use({ label: 'Scatta', stress: 1, per: 'rest', bonus: { roll: 1 }, note: 'Ti muovi entro distanza Lontana senza tirare. Il +1 vale se attacchi subito un avversario in mischia.' })],
  'bone-i-see-it-coming': [use({ label: 'Schiva', stress: 1, dice: { dice: '1d4', label: 'Evasione in più' }, note: 'Aggiungi il risultato alla tua Evasione contro questo attacco.' })],
  'bone-ferocity': [use({ label: 'Ferocia', hope: 2, note: 'La tua Evasione aumenta dei PF che hai fatto segnare, fino al prossimo attacco contro di te.' })],
  'bone-strategic-approach': {
    tokens: true,
    actions: [
      use({ label: 'Dopo il riposo lungo', fill: 'knowledge' }, 'fill'),
      use({ label: 'Vantaggio', tokens: 1, bonus: { adv: true } }, 'adv'),
      use({ label: '+1d8 ai danni', tokens: 1, bonus: { dmg: '1d8' } }, 'dmg'),
      use({ label: 'Alleato −1 Stress', tokens: 1, note: 'Un alleato in mischia con l’avversario toglie uno Stress. ' + N.ally }, 'ally'),
    ],
  },
  'bone-brace': [use({ label: 'Slot extra', stress: 1, self: { armor: 1 }, note: 'Segni uno slot Armatura in più per ridurre il danno.' })],
  'bone-tactician': [use({ label: 'Promemoria', note: 'Quando aiuti, l’alleato può spendere una Speranza per aggiungere una tua Esperienza. Nei Tiri di Squadra puoi usare un d20 come Dado Speranza.' })],
  'bone-boost': [strike({ stress: 1, bonus: undefined, extras: [{ label: '+1d10 (Lanciami!)', dice: '1d10', type: 'phy' }], note: 'Attacchi con vantaggio un bersaglio entro distanza Lontana e finisci in mischia con lui. Attiva il vantaggio nel tiro.' })],
  'bone-redirect': [
    use({ label: 'Tira i d6', dice: { dice: '1d6', label: 'Devia', count: 'prof' }, note: 'Se esce almeno un 6 puoi segnare uno Stress per deviare l’attacco su un avversario entro distanza Prossima.' }),
    use({ label: 'Devia l’attacco', stress: 1, note: 'L’attacco colpisce invece un avversario entro distanza Prossima.' }, 'redirect'),
  ],
  'bone-know-thy-enemy': [
    { id: 'roll', label: 'Osserva', roll: 'instinct', note: 'Se riesci, spendi una Speranza (tasto Chiedi informazioni) e chiedi un gruppo di informazioni al master.' },
    use({ label: 'Chiedi informazioni', hope: 1, note: 'PF e Stress liberi, Difficoltà e soglie, tattiche e danni, oppure privilegi ed Esperienze.' }, 'ask'),
    use({ label: 'Togli una Paura al GM', stress: 1 }, 'fear'),
  ],
  'bone-signature-move': [use({ label: 'Mossa distintiva', per: 'rest', note: 'Nel tiro puoi usare un d20 come Dado Speranza; se riesci togli uno Stress.' })],
  'bone-rapid-riposte': [use({ label: 'Contrattacca', stress: 1, damage: weapon(), note: 'Dopo un attacco in mischia fallito contro di te: infliggi all’attaccante il danno dell’arma.' })],
  'bone-recovery': [use({ label: 'Anche un alleato', hope: 1, note: 'Durante un riposo breve un alleato può scegliere una mossa da riposo lungo.' })],
  'bone-bone-touched': [use({ label: 'Fai fallire un attacco', hope: 3, per: 'rest', note: 'Con 4 carte Ossa. Ricorda anche +1 all’Agilità.' })],
  'bone-cruel-precision': [use({ label: '+Finezza ai danni', bonusFn: c => ({ dmg: String(Math.max(traitValue(c.data, 'finesse'), traitValue(c.data, 'agility'))) }), note: 'Dopo un attacco riuscito con un’arma.' })],
  'bone-breaking-blow': [use({ label: 'Prepara il colpo', stress: 1, bonus: { dmg: '2d12' }, note: 'Vale per il prossimo attacco riuscito contro lo stesso bersaglio.' })],
  'bone-wrangle': [{ id: 'roll', label: 'Raduna', roll: 'agility', hope: 1, note: 'Sposti i bersagli colpiti e gli alleati consenzienti entro distanza Ravvicinata.' }],
  'bone-splintering-strike': [strike({ hope: 1, per: 'longRest', extras: [{ label: 'Dado extra per bersaglio', dice: '1d10', type: 'phy' }], note: 'Distribuisci il danno tra i bersagli colpiti; prima di applicarlo a ciascuno tira un dado di danno in più (usa quello della tua arma).' })],
  'bone-deathrun': [strike({ hope: 3, damage: weapon({ profDelta: 1 }), note: 'Primo bersaglio: tutto il danno. Poi togli un dado per ogni bersaglio successivo.' })],
  'bone-swift-step': [
    use({ label: '−1 Stress', self: { stress: -1 } }, 'stress'),
    use({ label: '+1 Speranza', self: { hope: 1 } }, 'hope'),
  ],

  // ── Codice ──────────────────────────────────────────────────────────
  'codex-book-of-ava': [
    cast({ damage: magP('d10+2'), note: 'Il bersaglio colpito viene scagliato fino a distanza Lontana.' }, 'push', 'Spinta Magica'),
    use({ label: 'Armatura di Tava', hope: 1, note: 'Il bersaglio che tocchi ha +1 al Punteggio Armatura fino al suo prossimo riposo.' }, 'tava'),
    cast({ difficulty: 12, damage: phyP('d6'), note: 'Se lo usi come arma, tira contro la Difficoltà del bersaglio.' }, 'ice', 'Spunzone di Ghiaccio'),
  ],
  'codex-book-of-illiat': [
    cast({ note: 'Se riesci, il bersaglio è Addormentato finché non subisce danni.' }, 'slumber', 'Torpore'),
    use({ label: 'Salva Arcana', per: 'rest', scale: { by: 'hope', what: 'Speranze' }, damage: mag('d6', { count: 'scale' }) }, 'volley'),
    use({ label: 'Telepatia', hope: 1 }, 'telepathy'),
  ],
  'codex-book-of-tyfar': [
    cast({ damage: mag('2d6'), note: 'Fino a tre avversari in mischia; chi è colpito segna anche uno Stress.' }, 'flame', 'Fiamma Selvaggia'),
    use({ label: 'Mano Magica', note: 'Una mano magica entro distanza Lontana.' }, 'hand'),
    cast({ difficulty: 13, note: 'Nebbia fitta in un’area entro distanza Prossima.' }, 'mist', 'Foschia'),
  ],
  'codex-book-of-sitil': [
    use({ label: 'Camuffamento' }, 'disguise'),
    use({ label: 'Gemellare', hope: 2, note: 'Il prossimo attacco del bersaglio può colpire un bersaglio in più.' }, 'twin'),
    cast({ difficulty: 14, note: 'Un’illusione visiva non più grande di te entro distanza Ravvicinata.' }, 'illusion', 'Illusione'),
  ],
  'codex-book-of-vagras': [
    cast({ difficulty: 15, per: 'rest', note: 'Chiudi l’oggetto: lo aprono solo le creature che scegli.' }, 'lock', 'Chiavistello'),
    cast({ difficulty: 13, hope: 1, note: 'Un portale fino a un punto entro distanza Lontana.' }, 'gate', 'Varco Arcano'),
    cast({ note: 'Ciò che è nascosto magicamente entro distanza Ravvicinata viene rivelato.' }, 'reveal', 'Svelare'),
  ],
  'codex-book-of-korvax': [
    cast({ note: 'Sollevi il bersaglio e lo sposti entro distanza Ravvicinata.' }, 'levitate', 'Levitazione'),
    use({ label: 'Smentire', hope: 1, note: 'Il bersaglio fa un Tiro Reazione (15): se fallisce dimentica l’ultimo minuto.' }, 'recant'),
    use({ label: 'Cerchio Runico', stress: 1, damage: mag('2d12+4', { to: 'agli avversari in mischia o che entrano nel cerchio' }) }, 'circle'),
  ],
  'codex-book-of-norai': [
    cast({ note: 'Il bersaglio è Trattenuto e segna uno Stress.' }, 'lasso', 'Laccio Mistico'),
    cast({ damage: magP('d20+5', { to: 'a chi fallisce il Tiro Reazione (13); metà a chi riesce' }), note: 'Colpisce il bersaglio e chi gli sta entro distanza Prossima.' }, 'fireball', 'Palla di Fuoco'),
  ],
  'codex-book-of-exota': [
    cast({ reaction: true, per: 'rest', note: 'Se riesci, l’effetto magico si interrompe.' }, 'repudiate', 'Ripudiare'),
    use({ label: 'Creare Costrutto', hope: 1 }, 'construct'),
    cast({ damage: phy('2d10+3'), note: 'Ordina al costrutto di agire.' }, 'order', 'Comanda il costrutto'),
  ],
  'codex-book-of-grynn': [
    use({ label: 'Deflessione Arcana', hope: 1, per: 'longRest', note: 'Annulli il danno di un attacco contro te o un alleato entro distanza Prossima.' }, 'deflect'),
    cast({ note: 'Chi prova a spostare l’oggetto fermato: tiri contro di lui per mantenere l’incantesimo.' }, 'lock', 'Cronolucchetto'),
    cast({ difficulty: 15, damage: mag('4d10+3', { to: 'a chi attraversa il muro' }) }, 'wall', 'Muro di Fiamme'),
  ],
  'codex-manifest-wall': [cast({ difficulty: 15, per: 'rest', hope: 1, note: 'Un muro alto fino a 15 metri tra due punti entro distanza Lontana.' })],
  'codex-teleport': [cast({ difficulty: 16, per: 'longRest', note: 'Prima scegli il modificatore: luogo noto molto bene +3, spesso +1, di rado 0, una volta −2.' })],
  'codex-banish': [cast({ per: 'rest', dice: { dice: '1d20', label: 'Esilio', count: 'spellcast' }, note: 'Il bersaglio tira una reazione con Difficoltà pari al tuo d20 più alto: se fallisce viene esiliato, se riesce segna uno Stress.' })],
  'codex-sigil-of-retribution': {
    tokens: true,
    actions: [
      use({ label: 'Marca il nemico', fill: 0, note: 'Il GM guadagna una Paura.' }, 'mark'),
      use({ label: 'Aggiungi un d8', scale: { by: 'free', what: 'd8 da aggiungere', max: 'level' }, addTokens: true }, 'add'),
      use({ label: 'Scarica nel danno', scale: { by: 'tokens', what: 'd8 da usare' }, bonusFn: (_c, n) => ({ dmg: `${n}d8` }), note: 'Aggiungi il totale al prossimo danno contro il nemico marcato.' }, 'use'),
    ],
  },
  'codex-book-of-homet': [
    cast({ difficulty: 13, per: 'rest', note: 'Attraversi un muro o una porta con chi ti tocca.' }, 'pass', 'Oltrepasso'),
    cast({ difficulty: 14, per: 'longRest', note: 'Un portale verso un altro piano in cui sei già stato.' }, 'portal', 'Portale'),
  ],
  'codex-codex-touched': [
    use({ label: '+Competenza al Tiro Incantesimo', stress: 1, bonusFn: c => ({ roll: Math.max(1, c.data.proficiency ?? 1) }) }, 'prof'),
    use({ label: 'Scambia con il Rifugio', per: 'rest', note: 'Scambi questa carta con una del Rifugio senza Costo di Richiamo.' }, 'swap'),
  ],
  'codex-book-of-vyola': [
    cast({ note: 'Se riesci, fai una domanda al master sui ricordi del bersaglio.' }, 'dive', 'Tuffo nella Memoria'),
    use({ label: 'Lucidità Condivisa', hope: 1, per: 'longRest' }, 'clarity'),
  ],
  'codex-safe-haven': [use({ label: 'Evoca il Rifugio', hope: 2, note: 'Riposando qui scegli una mossa da interludio in più.' })],
  'codex-book-of-ronin': [
    cast({ difficulty: 15, note: 'Ti trasformi in un oggetto inanimato finché non subisci danni.' }, 'transform', 'Trasformazione'),
    cast({ per: 'longRest', note: 'Il bersaglio diventa Vulnerabile per sempre.' }, 'exhaust', 'Spossatezza Eterna'),
  ],
  'codex-disintegration-wave': [cast({ difficulty: 18, per: 'longRest', note: 'Il master ti dice chi ha Difficoltà 18 o meno: segna uno Stress per ognuno che vuoi annientare (usa «Segna Stress»).' }), use({ label: 'Segna 1 Stress', stress: 1 }, 'stress')],
  'codex-book-of-yarrow': [
    cast({ difficulty: 18, note: 'Il tempo si ferma per tutti tranne te, fino al tuo prossimo tiro che bersaglia qualcuno.' }, 'time', 'Inceppatempo'),
    use({ label: 'Immunità alla Magia', hope: 5, note: 'Immune ai danni magici fino al prossimo riposo.' }, 'immune'),
  ],
  'codex-transcendent-union': [use({ label: 'Lancia', hope: 5, per: 'longRest', note: 'Le creature unite scelgono chi segna Stress e PF fino al tuo prossimo riposo.' })],
}
