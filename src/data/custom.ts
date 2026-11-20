// Retaggi homebrew del tavolo (carte di Dercas). Quelli con lo stesso id di un
// retaggio dell'SRD lo sostituiscono (earthkin, emberkin, skykin, tidekin, gnome).
// `mods` applica bonus fissi in automatico; il resto è testo da applicare al tavolo.
import type { Heritage } from './index'

const img = (id: string) => ({ image: `./ancestries/${id}.jpg`, card: `./ancestries/${id}-card.jpg` })

export const CUSTOM_ANCESTRIES: Heritage[] = [
  {
    id: 'avian', name: 'Avian', custom: true, ...img('avian'),
    description: 'Gli Avian assomigliano a uccelli antropomorfi dotati di ali possenti e di una vista incredibilmente acuta.',
    features: [
      { name: 'Occhio di Falco', text: 'Quando effettui un tiro di attacco a distanza ravvicinata o maggiore, puoi spendere 2 punti Speranza per ripetere il tiro del dado Speranza.' },
      { name: 'Volo rapido', text: 'Puoi volare.\nMentre voli, puoi segnare uno Stress per muoverti da una distanza maggiore come parte della tua azione senza effettuare un tiro di Agilità.' },
    ],
  },
  {
    id: 'bugbear', name: 'Bugbear', custom: true, ...img('bugbear'),
    description: 'I bugbear sono imponenti umanoidi ricoperti di pelo ruvido, con braccia lunghe, orecchie a forma di cuneo e denti aguzzi.',
    features: [
      { name: 'Attacco a sorpresa', text: 'Ottieni Vantaggio sugli attacchi che effettui mentre sei Nascosto.' },
      { name: 'Raggio d’azione', text: 'Considera qualsiasi arma, abilità, incantesimo o altra caratteristica che abbia una portata in Mischia come se avesse invece una portata Molto ravvicinata.' },
    ],
  },
  {
    id: 'earthkin', name: 'Earthkin', custom: true, ...img('earthkin'),
    description: 'Gli Earthkin discendono dagli elementali della terra. Sono umanoidi il cui corpo è una combinazione di carne e terra.',
    features: [
      { name: 'Pelle di pietra', text: 'Ottieni un bonus di +1 al tuo valore di armatura e alle tue soglie di danno.', mods: { armor: 1, thresholds: 1 } },
      { name: 'Inamovibile', text: 'Finché i tuoi piedi toccano il suolo, non puoi essere sollevato o spostato contro la tua volontà.' },
    ],
  },
  {
    id: 'emberkin', name: 'Emberkin', custom: true, ...img('emberkin'),
    description: 'Gli Emberkin discendono dagli elementali del fuoco. Sono umanoidi il cui corpo è una combinazione di carne e fuoco.',
    features: [
      { name: 'Resistente al fuoco', text: 'Sei immune ai danni causati dalle fiamme, sia magiche che ordinarie.' },
      { name: 'Accensione', text: 'Segna un punto Stress per avvolgere la tua arma principale nelle fiamme fino alla fine della scena. Mentre è in fiamme, emette una luce intensa e conferisce un bonus di 1d6 ai tiri per il danno contro bersagli a distanza ravvicinata.' },
    ],
  },
  {
    id: 'gnome', name: 'Gnomi', custom: true, ...img('gnome'),
    description: 'Gli gnomi sono piccoli umanoidi facilmente riconoscibili per la loro muscolatura possente, le braccia lunghe e i lineamenti marcati.',
    features: [
      { name: 'Dita agili', text: 'Quando effettui un tiro di Astuzia, puoi spendere 2 punti Speranza per ripetere il lancio del dado della Speranza.' },
      { name: 'Vista vera', text: 'Hai vantaggio nei tiri per vedere oltre le illusioni.' },
    ],
  },
  {
    id: 'junace', name: 'Junace', custom: true, ...img('junace'),
    description: 'Un popolo plasmato dalle paludi avvolte dalla nebbia della propria terra d’origine; vigili, immobili e difficili da cogliere di sorpresa.',
    features: [
      { name: 'Segnale d’allarme', text: 'Hai vantaggio nei tiri di Reazione contro attacchi che non hai potuto prevedere.' },
      { name: 'Attesa immobile', text: 'Spendi 1 Speranza per ottenere la condizione Nascosto fino al tuo prossimo momento di ribalta.' },
    ],
  },
  {
    id: 'kenku', name: 'Kenku', custom: true, ...img('kenku'),
    description: 'I kenku assomigliano ad uccelli antropomorfi. Eccellono nell’imitazione grazie ad un’eccellente memoria.',
    features: [
      { name: 'Mimetizzatore piumato', text: 'Hai vantaggio sui tiri di Presenza per imitare suoni o voci allo scopo di ingannare o distrarre. Spendi 1 Speranza per effettuare un tiro di Incantesimo contro una creatura che ti capisce: con successo, subisce 1 Stress.' },
      { name: 'Cose viste e sentite', text: 'Due volte per riposo lungo, prima di un tiro di azione puoi subire 1 Stress per ricordare qualcosa che hai visto o sentito e usare un d20 come Dado della Speranza per quel tiro.' },
    ],
  },
  {
    id: 'kitsune', name: 'Kitsune', custom: true, ...img('kitsune'),
    description: 'Le kitsune dalla coda folta assomigliano a volpi antropomorfe. Con i loro musetti affilati e le orecchie appuntite, ben poco sfugge ai loro sensi.',
    features: [
      { name: 'Astuzia', text: 'Ignori lo svantaggio sui tiri di Presenza.' },
      { name: 'Furbizia', text: 'Una volta per riposo breve, subito dopo che un altro personaggio ha terminato un movimento a distanza «Molto Vicino» da te, puoi segnare uno Stress per spostarti a distanza «Molto Vicino».' },
    ],
  },
  {
    id: 'mallard', name: 'Mallard', custom: true, ...img('mallard'),
    description: 'I mallard assomigliano ad anatre antropomorfe con arti privi di ali e zampe palmate.',
    features: [
      { name: 'Nuotatore naturale', text: 'Riesci a respirare e a muoverti in modo naturale sia in acqua che sott’acqua.' },
      { name: 'Temperamento collerico', text: 'Segna un punto Stress per arrabbiarti e ottenere un vantaggio negli attacchi o nei tiri per intimidire le creature ostili.' },
    ],
  },
  {
    id: 'merfolk', name: 'Merfolk', custom: true, ...img('merfolk'),
    description: 'I tritoni sono creature umanoidi in sintonia con il mare; hanno branchie simili a quelle dei pesci e pinne o tentacoli.',
    features: [
      { name: 'Escrescenze coralline', text: 'Quando devi contrassegnare uno slot per l’armatura, lancia un d6. Se ottieni un 6, non contrassegnarlo.' },
      { name: 'Lingua del mare', text: 'Puoi comunicare con le creature marine, le alghe e altre forme di vita acquatiche. Questa flora e fauna ti considerano naturalmente un alleato.' },
    ],
  },
  {
    id: 'saurus', name: 'Saurus', custom: true, ...img('saurus'),
    description: 'I Saurus sono umanoidi rettiliani a sangue freddo, di varie dimensioni e corporature.',
    features: [
      { name: 'Scaglie', text: 'Le tue scaglie fungono da protezione naturale. Quando subiresti un danno grave, puoi segnare un punto Stress per perdere 1 punto vita in meno.' },
      { name: 'Primordiale', text: 'Quando infliggi il colpo finale a un avversario in qualsiasi modo, guadagni 1 punto Speranza o cancelli 1 punto Stress.' },
    ],
  },
  {
    id: 'skykin', name: 'Skykin', custom: true, ...img('skykin'),
    description: 'Gli Skykin discendono dagli elementali dell’aria. Sono umanoidi il cui corpo è una combinazione di carne e aria.',
    features: [
      { name: 'Forza della Tempesta', text: 'Segna un punto Stress per evocare una raffica di vento che trasporta te o un alleato fino a una distanza molto lontana. Inoltre, puoi sempre controllare la velocità con cui cadi.' },
      { name: 'Occhio della Tempesta', text: 'Spendi 2 punti Speranza per concedere un bonus di +1 alla tua Evasione o a quella di un alleato fino a quando non subisci danni Gravi o non usi nuovamente Occhio della Tempesta.' },
    ],
  },
  {
    id: 'tidekin', name: 'Tidekin', custom: true, ...img('tidekin'),
    description: 'I Tidekin discendono dagli elementali dell’acqua. Sono umanoidi il cui corpo è una combinazione di carne e acqua.',
    features: [
      { name: 'Anfibio', text: 'Puoi respirare e muoverti con naturalezza sott’acqua.' },
      { name: 'Sorgente di vita', text: 'Una volta per riposo, quando hai a disposizione una piccola quantità d’acqua, puoi segnare 2 punti Stress per curare un punto ferita a te stesso o a un alleato.' },
    ],
  },
  {
    id: 'treant', name: 'Treant', custom: true, ...img('treant'),
    description: 'I treant assomigliano ad alberi antropomorfi, con la corteccia al posto della pelle e la vegetazione che cresce su di loro.',
    features: [
      { name: 'Corteccia', text: 'Ottieni 2 slot di armatura aggiuntivi al momento della creazione del personaggio.', mods: { armor: 2 } },
      { name: 'Radici', text: 'Hai vantaggio nei tiri di Forza per spingere, tirare o resistere.' },
    ],
  },
  {
    id: 'were-boar', name: 'Were-boar', custom: true, ...img('were-boar'),
    description: 'I Were-boar sono esseri umani in grado di assumere la forma di un cinghiale antropomorfo.',
    features: [
      { name: 'Nati dall’oro', text: 'Ottieni uno slot Speranza aggiuntivo alla creazione del personaggio.', mods: { hope: 1 } },
      { name: 'Mutaforma', text: 'Segna uno Stress per assumere la forma di cinghiale. Torni alla tua forma normale dopo 4 azioni, che puoi prolungare segnando un altro Stress. In quella forma: riduci il danno subito di 1d6 e hai vantaggio sui tiri di Forza contrapposti.' },
    ],
  },
  {
    id: 'were-shark', name: 'Were-shark', custom: true, ...img('were-shark'),
    description: 'I Were-shark sono esseri umani in grado di assumere la forma di uno squalo antropomorfo.',
    features: [
      { name: 'Nato dal mare', text: 'Ottieni uno slot per l’armatura al momento della creazione del personaggio.', mods: { armor: 1 } },
      { name: 'Mutaforma', text: 'Segna uno Stress per assumere la tua forma di squalo. Torni alla tua forma normale dopo 4 azioni, puoi prolungare segnando un altro Stress. In quella forma: quando riesci in un attacco a distanza ravvicinata, puoi spendere una Speranza per rendere il bersaglio Immobilizzato finché rimani a distanza ravvicinata. Puoi respirare e nuotare sott’acqua.' },
    ],
  },
  {
    id: 'zardai', name: 'Zardai', custom: true, ...img('zardai'),
    description: 'Gli zardai assomigliano a lucertole umanoidi con spesse squame, muso dentato e code possenti.',
    features: [
      { name: 'Pelle squamosa', text: 'Ottieni un bonus di +1 ai tuoi Punti Ferita e alla tua Soglia di Danno.', mods: { hp: 1, thresholds: 1 } },
      { name: 'Intuizione naturale', text: 'Ignori lo svantaggio nei tiri di Istinto.' },
    ],
  },
]
