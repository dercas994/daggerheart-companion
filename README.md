# Daggerheart Companion

Sito e app Android per giocare a Daggerheart al tavolo:

- **Master**: crea le campagne, condivide un codice invito, gestisce la Paura (0–12), vede il gruppo e tutti i tiri in tempo reale (con l'animazione dei dadi quando tira un giocatore).
- **Giocatori**: entrano con il codice, creano il personaggio con una procedura guidata (classe, sottoclasse, retaggio, comunità, tratti, equipaggiamento, esperienze, carte dominio), tirano i dadi di Dualità e vedono vita, stress e speranza dei compagni.
- **Tiro di Dualità**: i dadi si tirano sul server. Con Speranza il PG guadagna 1 Speranza, con Paura il master guadagna 1 Paura, sul critico +1 Speranza e −1 Stress. Esperienze (spendono Speranza), vantaggio e svantaggio sono gestiti.
- **Scheda in gioco**: PF, Stress, Speranza, Armatura cliccabili, soglie di danno calcolate, calcolo del danno, riposo breve e lungo, salita di livello con avanzamenti, loadout e vault delle carte con costo di richiamo, condizioni, inventario e note.

Stack: React 19 + TypeScript + Vite, Supabase (Auth, Postgres con RLS, Realtime), Capacitor per l'APK.

---

## 1. Prepara Supabase

1. Apri il tuo progetto su supabase.com, vai su **SQL Editor**, incolla tutto `supabase/schema.sql` ed esegui. Puoi rilanciarlo senza perdere dati.
2. **Authentication → Providers → Email**: lascia attivo Email. Se non vuoi la mail di conferma (comodo tra amici) disattiva *Confirm email*.
3. **Authentication → URL Configuration**: in *Site URL* metti l'indirizzo dove pubblicherai il sito (per ora `http://localhost:5173`).
4. **Project Settings → API Keys**: copia la *Publishable key* (`sb_publishable_…`, va bene anche la vecchia *anon key*). L'URL è `https://<id-progetto>.supabase.co`.

## 2. Avvia il sito in locale

Serve Node.js 20 o più recente.

```bash
cp .env.example .env.local      # poi inserisci URL e anon key
npm install
npm run dev                     # http://localhost:5173
```

Per provarlo da telefono sulla stessa rete: `npm run dev -- --host` e apri l'IP del PC.

## 3. Pubblica il sito

`npm run build` crea la cartella `dist/`, un sito statico. Va bene qualsiasi hosting statico (Netlify, Vercel, Cloudflare Pages, GitHub Pages o un tuo server). Le variabili `VITE_SUPABASE_*` vanno impostate anche sull'hosting. Ricordati di aggiornare la *Site URL* su Supabase.

Il sito è installabile come app dal browser (PWA): su Android, Chrome, menu, *Aggiungi a schermata Home*.

## 4. App Android (APK)

Serve Android Studio.

```bash
npm run android:init     # solo la prima volta: crea la cartella android/
npm run android:sync     # dopo ogni modifica: build + copia in android/
npm run android:open     # apre Android Studio
```

In Android Studio: *Build → Build App Bundle(s) / APK(s) → Build APK(s)*. L'APK finisce in `android/app/build/outputs/apk/debug/`. L'URL di Supabase viene incluso nella build, quindi `.env.local` deve essere compilato prima di `android:sync`.

## 5. Contenuti di gioco e traduzione

`src/data/srd.json` contiene classi, sottoclassi, retaggi, comunità, armi, armature e le 210 carte dominio (10 domini, incluso Terrore) estratti dal **Daggerheart SRD 2.0**, contenuto pubblico secondo la [Darrington Press Community Gaming License](https://www.darringtonpress.com/license). I testi sono in inglese come nell'SRD; l'interfaccia, i nomi di classi, domini e tratti sono in italiano.

Per tradurre una carta o un privilegio aggiungi `name_it` e `text_it` all'oggetto in `srd.json`: l'app li mostra al posto dell'inglese.

> Daggerheart è un marchio di Critical Role LLC. Questo è un progetto personale non commerciale, non affiliato a Darrington Press.

## Struttura

```
supabase/schema.sql        tabelle, RLS, RPC (create_campaign, join_campaign, roll_duality), realtime
src/lib/backend/           client Supabase
src/lib/rules.ts           regole: soglie, evasione, avanzamenti, danni
src/lib/live.ts            stato della campagna in tempo reale
src/pages/                 Auth, Home, Campaign (master/giocatore), Wizard, Character
src/components/            dadi animati, tiro, carte, party, riposo, danno, livello, modifica
src/styles/app.css         tutto lo stile
```
