/** Splendore, Valore. */
import type { CardAction, CardDef } from '../cardEffects'
import { traitValue } from '../rules'
import { cast, mag, magP, N, phy, strike, use } from './h'

export const CARDS_C: Record<string, CardAction[] | CardDef> = {
  // ── Splendore ───────────────────────────────────────────────────────
  'splendor-bolt-beacon': [cast({ hope: 1, damage: magP('d8+2'), note: 'Il bersaglio è Vulnerabile e brilla.' })],
  'splendor-mending-touch': [
    use({ label: 'Cura (2 Speranze)', hope: 2, note: 'Togli un PF o uno Stress alla creatura. ' + N.ally }, 'heal'),
    use({ label: 'Cura profonda', hope: 2, per: 'longRest', note: 'Togli 2 PF o 2 Stress. ' + N.ally }, 'deep'),
  ],
  'splendor-reassurance': [use({ per: 'rest', note: 'L’alleato ritira i dadi.' })],
  'splendor-final-words': [cast({ difficulty: 13, note: 'Con Speranza tre domande, con Paura una.' })],
  'splendor-healing-hands': [cast({ difficulty: 13, stress: 1, note: 'Riuscito: togli 2 PF o 2 Stress al bersaglio. Fallito: 1. ' + N.ally })],
  'splendor-second-wind': [
    use({ label: '−3 Stress', per: 'rest', self: { stress: -3 } }, 'stress'),
    use({ label: '−1 PF', per: 'rest', self: { hp: -1 } }, 'hp'),
  ],
  'splendor-voice-of-reason': [use({ label: '+1 Competenza', bonus: { prof: 1 }, note: 'Quando hai tutto lo Stress segnato.' })],
  'splendor-divination': [use({ label: 'Divina', hope: 3, per: 'longRest' })],
  'splendor-life-ward': [use({ label: 'Salvaguardia', hope: 3, note: 'L’alleato, invece di una mossa mortale, toglie un PF.' })],
  'splendor-shape-material': [use({ label: 'Plasma', hope: 1 })],
  'splendor-smite': [use({ label: 'Carica il colpo', hope: 3, per: 'rest', note: 'Il prossimo danno con l’arma va raddoppiato ed è magico.' })],
  'splendor-restoration': {
    tokens: true,
    actions: [
      use({ label: 'Dopo il riposo lungo', fill: 'spellcast' }, 'fill'),
      use({ label: 'Cura', scale: { by: 'tokens', what: 'segnalini (2 PF o 2 Stress ciascuno)' }, note: N.ally }, 'heal'),
    ],
  },
  'splendor-zone-of-protection': [cast({ difficulty: 16, per: 'longRest', note: 'Il dado della zona parte da 1: riduce i danni e sale di uno a ogni colpo.' })],
  'splendor-healing-strike': [use({ label: 'Cura un alleato', hope: 2, note: 'L’alleato entro Ravvicinata toglie un PF. ' + N.ally })],
  'splendor-splendor-touched': [use({ label: 'Stress invece di PF', per: 'longRest', note: 'Con 4 carte Splendore. Ricorda anche +3 alla soglia Grave.' })],
  'splendor-shield-aura': [use({ label: 'Scudo Magico', stress: 1 })],
  'splendor-stunning-sunlight': [cast({ scale: { by: 'hope', what: 'Speranze (una per bersaglio)' }, damage: mag('4d20+5', { to: 'a chi fallisce il Tiro Reazione (14), che è anche Stordito' }), extras: [{ label: 'Chi riesce: 3d20+3', dice: '3d20+3', type: 'mag' }] })],
  'splendor-overwhelming-aura': [cast({ difficulty: 15, hope: 2, note: 'La tua Presenza vale il tratto da incantatore fino al riposo lungo.' })],
  'splendor-salvation-beam': [cast({ difficulty: 16, scale: { by: 'stress', what: 'Stress (un PF curato ciascuno)' }, note: 'Distribuisci i PF curati tra gli alleati in fila. ' + N.ally })],
  'splendor-invigoration': [use({ label: 'Ravviva', scale: { by: 'hope', what: 'Speranze' }, dice: { dice: '1d6', label: 'Ravvivare', count: 'scale' }, note: 'Con almeno un 6 il privilegio si può riusare.' })],
  'splendor-resurrection': [cast({ difficulty: 20, dice: { dice: '1d6', label: 'Resurrezione' }, note: 'Con 5 o meno la carta va nel Rifugio per sempre.' })],

  // ── Valore ──────────────────────────────────────────────────────────
  'valor-forceful-push': [strike({ extras: [{ label: 'Con Speranza: +1d6', dice: '1d6', type: 'phy' }], note: 'Il bersaglio viene scagliato fino a Ravvicinata.' }), use({ label: 'Rendi Vulnerabile', hope: 1 }, 'vuln')],
  'valor-i-am-your-shield': [use({ label: 'Fai da scudo', stress: 1, note: 'Diventi tu il bersaglio; puoi segnare quanti slot Armatura vuoi.' })],
  'valor-body-basher': [use({ label: '+Forza ai danni', bonusFn: c => ({ dmg: String(traitValue(c.data, 'strength')) }), note: 'Attacco riuscito in mischia.' })],
  'valor-bold-presence': [
    use({ label: '+Forza al Tiro Presenza', hope: 1, bonusFn: c => ({ roll: traitValue(c.data, 'strength') }) }, 'presence'),
    use({ label: 'Evita una condizione', per: 'rest' }, 'avoid'),
  ],
  'valor-critical-inspiration': [use({ per: 'rest', note: 'Dopo un critico gli alleati entro Prossima tolgono uno Stress o guadagnano una Speranza. ' + N.ally })],
  'valor-lean-on-me': [use({ per: 'longRest', self: { stress: -2 }, note: 'Anche l’alleato toglie 2 Stress. ' + N.ally })],
  'valor-goad-them-on': [{ id: 'roll', label: 'Provoca', roll: 'presence', note: 'Se riesci il bersaglio segna uno Stress e la prossima volta deve attaccare te, con svantaggio.' }],
  'valor-support-tank': [use({ label: 'L’alleato ritira', hope: 2 })],
  'valor-rousing-strike': [use({ label: '−1 PF', per: 'rest', self: { hp: -1 } }, 'hp'), use({ label: '−1d4 Stress', per: 'rest', dice: { dice: '1d4', label: 'Stress rimossi' } }, 'stress')],
  'valor-inevitable': [use({ label: 'Vantaggio dopo un fallimento', bonus: { adv: true } })],
  'valor-rise-up': [use({ label: '−1 Stress', self: { stress: -1 }, note: 'Quando segni PF per un attacco.' })],
  'valor-shrug-it-off': [use({ label: 'Riduci il danno', stress: 1, dice: { dice: '1d6', label: 'Solo un graffio' }, note: 'Il danno scende di una soglia. Con 3 o meno la carta va nel Rifugio.' })],
  'valor-valor-touched': [use({ label: 'Libera 1 Armatura', self: { armor: -1 }, note: 'Quando segni PF senza segnare Armatura. Ricorda +1 al Punteggio Armatura.' })],
  'valor-full-surge': [use({ label: 'A tutta forza', stress: 3, per: 'longRest', note: '+2 a tutti i tratti fino al prossimo riposo: aggiungilo nel campo «Altro».' })],
  'valor-ground-pound': [{ id: 'roll', label: 'Schianta', roll: 'strength', hope: 2, damage: phy('4d10+8', { to: 'a chi fallisce il Tiro Reazione (17); metà a chi riesce' }), note: 'I bersagli colpiti vengono scagliati fino a Lontana.' }],
  'valor-hold-the-line': [use({ label: 'Serra i ranghi', hope: 1 })],
  'valor-lead-by-example': [use({ label: 'Incoraggia', stress: 1, note: 'Il prossimo PG che attacca quell’avversario toglie uno Stress o guadagna una Speranza.' })],
  'valor-unbreakable': [use({ label: 'Indistruttibile', dice: { dice: '1d6', label: 'PF rimossi' }, toVault: true, note: 'Togli dalla scheda tanti PF quanto il risultato.' })],
  'valor-unyielding-armor': [use({ label: 'Resisti', dice: { dice: '1d6', label: 'Corazza', count: 'prof' }, note: 'Con almeno un 6 il danno scende di una soglia senza segnare Armatura.' })],
}

