# EveryWhere — Roadmap tecnica

Checklist viva del percorso da demo Base44 a app in produzione.
Ogni tappa ha i suoi criteri di test: Marco fa da tester critico, niente
si spunta finché il test non passa.

**Stack:** Supabase (EU) · Cloudflare Pages · Capacitor · FCM · Sentry · Stripe (per ultimo)

**Regola di prodotto centrale:** un profilo è visibile solo a chi ha una sessione
attiva nello stesso locale o a un match. Nessun browsing esterno degli utenti.

---

## ✅ Step 1 — Fondamenta (completato)

- [x] Git su `main`, fix build (import case-sensitive), primo commit
- [x] Piano auth + schema dati approvati
- [ ] Push su GitHub (si fa all'inizio dello Step 4)

## ✅ Step 2 — Backend Supabase (completato)

- [x] Progetto Supabase dev (EU) + Google OAuth
- [x] Auth su Supabase (Google), interfaccia `useAuth()` invariata, Base44 rimosso
- [x] Migration: 10 tabelle, RLS verificata (anon = zero righe), RPC check-in/EV/match, bucket privati
- [x] Realtime su `messages`, `evs`, `matches`, `sessions`

## 🔨 Step 3 — Collegare il frontend (in corso)

### ✅ 3a — Profilo reale
- [x] Login → `/create-profile` → riga in `profiles` → smistamento automatico da `/`
- [x] Fix race su reload + precompilazione form

### ✅ 3b — Foto profilo (Storage)
- [x] Upload dal form profilo (bucket `avatars`, path `<uid>/…`, resize client-side)
- [x] Signed URL con cache in memoria (scadenza verificata: link valido subito,
      `InvalidJWT` dopo la scadenza); fallback avatar se assente
- [x] **Test:** carico una foto → la vedo su Profile e dopo un reload; il file
      compare in Storage sotto il mio uid; upload nella cartella di un altro
      utente bloccato da RLS; file malformati (PDF-come-jpg, vuoto, 40MB, gif)
      rifiutati lato client e lato server; rete lenta (Slow 3G) → loading/errore
      visibili, mai schermata muta; due upload di fila → resta l'ultimo dopo reload
- [ ] **Test rimandato a 3e:** un utente NON in sessione/match con me non può
      ottenere la signed URL della mia foto (serve un secondo account reale,
      naturale quando in 3e si testano persone/EV/match con 2 utenti)
- [x] **Fix trovato dal test:** `/profile` ora vive fuori da `SessionLayout`
      (che rimanda a `/home` senza sessione attiva); ingresso dall'avatar in
      alto a destra nella Home, bottom nav solo durante la sessione
- [x] **Logout reale** (utente e business): chiudeva solo lo stato mock senza
      terminare la sessione Supabase, quindi si rientrava subito. Verificato:
      si torna alla scelta account e ci si resta anche dopo reload

> **Decisione rivista:** l'email+password **è** un metodo di login reale
> dell'app (prima era solo un trucco per i test). In produzione la conferma
> email è obbligatoria; in dev si tiene disattivata.

### ✅ 3c-5 — Login/registrazione con email e password (implementato)
- [x] `signInWithEmail` / `signUpWithEmail` in AuthContext, con errori
      Supabase tradotti in italiano **per codice** (`error.code`), non per
      testo del messaggio
- [x] `EmailAuthForm` riutilizzato da Welcome e dal gate del business
- [x] Registrazione: se la conferma email è attiva non c'è sessione subito →
      schermata "controlla la tua email"; se è disattivata si entra diretti
- [x] Password minima 8 caratteri (Supabase di default ne accetta 6)
- [x] Email già registrata gestita anche quando Supabase la nasconde
      (anti-enumeration: utente con `identities` vuoto)
- [ ] **Da fare in Supabase (dev):** Authentication → Providers → Email →
      **disattivare "Confirm email"**. Oggi è ATTIVA: la registrazione non
      logga subito e l'invio email è limitato a poche all'ora
- [ ] **Recupero password: NON implementato.** Serve una pagina che gestisca
      il link di recupero (`type=recovery`) e permetta di impostare la nuova
      password. Obbligatorio prima della beta pubblica
- [ ] **Prima della produzione:** SMTP proprio (Resend/Postmark/SES). Il
      servizio email integrato di Supabase è limitato a poche email/ora e
      non è pensato per la produzione

### 3c-1 — Onboarding business: locale reale (da testare)
- [x] RPC `create_my_venue` atomica: profilo business + `venues` + `venue_qr_tokens`;
      `owner_id` sempre `auth.uid()`, token generato dal server, rifiuto se
      l'account è già `personal`
- [x] RPC `rotate_venue_qr` (solo owner, nuovo token lato server)
- [x] Gate di login prima del form + intento `business` memorizzato, così chi
      accede a metà strada non finisce nell'onboarding personale
- [x] **Fix trovato dal test:** la prima versione accettava `city`/`address`
      e non li scriveva. Aggiunte colonne `venue_type, address, city, phone,
      email, website, hours_open, hours_close` (+ limiti di lunghezza lato
      DB e `maxLength` nel form)
- [ ] **Test sicurezza (Marco):** anon respinto; token altrui non leggibile;
      insert diretto di un venue con `owner_id` altrui; rotazione QR di un
      locale non proprio; account già personale che registra un locale
- [ ] **Ancora NON persistiti:** P.IVA e referente amministrativo (identità
      di fatturazione → arrivano con Stripe, Step 6); logo e copertina (oggi
      sono campi URL liberi: vanno sostituiti da upload su Storage come gli
      avatar, non da URL arbitrari)

### 3c-2a — Dashboard business: QR e presenze (da testare)
- [x] QR reale (`qrcode.react`) sull'URL `/checkin?t=<token>`, con stampa
      (CSS dedicato: stampa solo il QR) e condivisione/copia link
- [x] Rotazione QR dalla UI, con conferma esplicita che invalida i codici
      già stampati
- [x] Presenze reali (`Presenti ora` / `Check-in totali`) con empty state;
      rimossi i numeri finti dalla home della dashboard
- [x] Rimossi il finto pagamento e i finti campi carta ("avvia sessione")
- [x] Insight resta dimostrativo ma ora lo dichiara con un avviso in pagina
- [x] Locale già registrato → l'onboarding porta alla dashboard
- [x] Stati loading / nessun-locale / errore con retry
- [ ] **Test:** QR visibile e scansionabile; rotazione cambia il codice;
      un utente normale non legge il token via API

### 3c-2b — Comunicazioni del locale (accorpato a 3g)
- [ ] CRUD `venue_messages` reale al posto dei mock (oggi il form non salva)
- [ ] Attenzione: la UI ha 4 categorie (promo/lineup/update/event) ma il DB
      ne accetta 2 (`promo`/`info`) → serve migration o riduzione della UI
- [ ] Si fa insieme alla pagina Locale (3g), che è dove i messaggi si vedono

### ✅ 3c-3 — Serate come entità centrale (DECISO e implementato, da testare)

Modello di business deciso: l'introito viene dalle serate, vendute come
**serata singola** o **abbonamento con serate illimitate**.

```
piano (subscription | pay_per_night)
  └── locale (venues)
        └── serate (nights) ← il QR sta QUI
              └── check-in utenti (sessions)
```

Regole scelte (aggiornate in 3c-4): la serata ha **orari programmati** di
apertura/chiusura **più** override manuale; il QR funziona **solo a serata
attiva**; la chiusura **termina tutte le sessioni** e spegne tutti i QR della
serata; **più serate aperte per locale sono ammesse**.

- [x] Tabelle `nights` + `night_qr_tokens`; `sessions.night_id`; `venues.plan`
- [x] RPC `create_night` / `open_night` / `close_night` / `rotate_night_qr`
- [x] `check_in` risolve il token → serata, e rifiuta se non è aperta
- [x] Visibilità profili ancorata alla **serata** (`active_session_night`):
      chiusa la serata le persone smettono di vedersi, anche se la sessione
      non è scaduta
- [x] `venue_qr_tokens` e `rotate_venue_qr` **rimossi** (QR di locale superato)
- [x] Dashboard: lista serate, crea/apri/chiudi, QR per serata, rotazione
- [x] Il piano scelto in onboarding viene salvato su `venues.plan`
- [ ] **Test:** creo una serata → QR generato ma non attivo; apro → il QR
      funziona; provo ad aprirne una seconda → rifiutata; chiudo → sessioni
      terminate e QR non più valido
- [ ] **Step 6:** `open_night` dovrà pretendere `payment_status in
      ('paid','waived')`. Oggi non blocca, altrimenti nulla sarebbe testabile
      senza Stripe. La colonna esiste già e viene valorizzata ('waived' con
      abbonamento, 'pending' con serata singola)

### ✅ 3c-4 — Più QR per serata + orari (implementato, da testare)

Correzioni al modello: una serata è **una festa con più punti di ingresso**
(QR generale + QR per sala/zona), ognuno con la propria finestra oraria.

- [x] Tabella `night_qr_codes` (molti QR per serata, con `label`,
      `starts_at`, `ends_at`); i token esistenti sono stati migrati, non persi
- [x] `nights.opens_at` / `closes_at` (orari programmati) accanto a
      `opened_at` / `closed_at` (override manuale); via la colonna `status`,
      lo stato ora si **deriva**: chiusura manuale > tutto, apertura manuale
      anticipa l'orario, l'orario di chiusura vale comunque
- [x] Caduto il vincolo "una sola serata aperta per locale"
- [x] `sessions.qr_code_id`: si registra da quale QR è entrata la persona
- [x] Riscansionando un altro QR della **stessa** serata la sessione non
      viene ricreata: cambia solo la posizione (l'orario d'ingresso resta)
- [x] La sessione non sopravvive alla chiusura programmata della serata
      (`expires_at` viene troncato a `closes_at`)
- [x] Chi entra da QR diversi della stessa serata **si vede**: la visibilità
      resta ancorata alla serata, non al QR
- [x] RPC `create_night_qr` / `update_night_qr` / `delete_night_qr` /
      `rotate_night_qr` (per singolo QR) / `update_night_schedule`;
      non si può eliminare l'ultimo QR di una serata
- [x] Dashboard: serate con orari, elenco QR per serata, presenze per sala
- [ ] **Test:** QR di sale diverse → le persone si vedono tra loro; QR fuori
      finestra → errore; riscansione nella stessa serata → cambia sala senza
      perdere la sessione; chiusura serata → tutti i QR spenti insieme

### 3e — Lista partecipanti: tutta la serata + la mia sala
- [ ] Grazie a `sessions.qr_code_id`, la lista mostrerà sia tutti i presenti
      alla serata sia chi è nella stessa sala in questo momento

### 3c-3 — Geocoding (prima che "locali vicini" funzioni)
- [ ] `venues.location` oggi è sempre `null`: `venues_nearby()` filtra
      `location is not null`, quindi i locali creati NON compaiono mai nella
      ricerca per vicinanza (nessun crash, semplicemente invisibili)
- [ ] Serve convertire `city + address` in lat/lng (es. Nominatim/OSM lato
      Edge Function, o inserimento manuale delle coordinate dalla dashboard)
- [ ] **Test:** locale con indirizzo reale → compare in `venues_nearby()` dal
      raggio giusto e non da uno sbagliato

### ✅ 3d-1 — Check-in reale via URL (implementato, da testare)
- [x] Pagina `/checkin?t=<token>`: token non valido, accesso richiesto,
      profilo mancante, ingresso in corso, errore del server, successo
- [x] Chi arriva senza account accede **restando sul QR** (Google torna
      esattamente lì); chi non ha profilo lo crea e viene riportato al check-in
- [x] Sessione reale in AppContext letta dal DB: sopravvive al reload
- [x] Timer calcolato dalla scadenza reale, non da un contatore che scala
      (un reload o il telefono in tasca non lo falsano più)
- [x] `endSession` chiama la RPC: uscendo si smette davvero di essere visibili
- [x] Errori distinti: QR sconosciuto, serata non aperta, QR non ancora
      attivo, QR scaduto
- [x] Rimossi il flusso mock `SessionConfirm` e la "Simula Scansione"
- [ ] **Test:** QR di una serata aperta → dentro col locale e la serata
      giusti → reload: ancora dentro → "esci": fuori davvero; QR di serata
      chiusa → messaggio chiaro; secondo QR della stessa serata → cambio
      sala senza far ripartire il tempo

### 3d-2 — Scanner con fotocamera
- [ ] Lettura QR dalla fotocamera in-app (oggi: inserimento manuale del
      codice, oppure si inquadra il QR con la fotocamera di sistema che apre
      l'app da sola, dato che il QR contiene l'URL completo)
- [ ] Gestione permesso fotocamera negato, e HTTPS richiesto dai browser

### 3e — Persone nel locale + EV + match (Realtime)
- [ ] RPC `people_in_my_venue()` (lista profili con sessione attiva nel mio locale — manca nello schema, va aggiunta con migration)
- [ ] Session page: persone reali; EV via RPC `send_ev` (con nota); ricevuti/matched via Realtime su `evs`/`matches`
- [ ] EVPage: EV ricevuti reali, ignora via `ignore_ev`, match celebration
- [ ] **Test (servono 2 account):** con due utenti nello stesso locale ci si
      vede; EV reciproco → match live su entrambi i telefoni senza refresh;
      un terzo utente fuori dal locale non vede nessuno

### 3f — Chat reale
- [ ] PersonDetail/chat su `messages` + subscription Realtime per match
- [ ] **Test (2 account):** messaggi live nei due sensi; un utente non nel
      match non può leggerli (verifica via API); la chat riappare dopo reload

### 3g — Locale, memories e rifiniture
- [ ] Pagina Locale: `venue_messages` reali del locale in sessione
- [ ] Memories: recap serate derivato da `sessions`+`evs`+`matches` (view SQL) + foto in bucket `memories`
- [ ] Drink: flusso UI reale ma stato `pending_payment` fittizio (Stripe allo Step 6)
- [ ] Logout visibile nel Profile; rimozione modalità ospite o suo confinamento a demo
- [ ] **Test:** giro completo dell'app senza incontrare più nessun dato finto

### 3h — Sicurezza utenti (obbligatorio per gli store)
- [ ] Tabella `blocks` + report utente (migration): chi blocco sparisce da liste/chat
- [ ] Segnalazione contenuti/persone con motivo
- [ ] **Test:** blocco un utente → invisibile nei due sensi anche in sessione
> Apple e Google RIFIUTANO app social/UGC senza block+report. Non negoziabile.

## 🚀 Step 4 — Online: deploy, monitoraggio, GDPR

- [ ] Repo GitHub + Cloudflare Pages (prod da `main`, preview per branch, SPA redirects)
- [ ] Progetto Supabase **prod** (EU): stessa migration, env separate, redirect URL prod su Google/Supabase
- [ ] Google OAuth consent screen in produzione (via da "Testing")
- [ ] Sentry frontend + uptime monitor (BetterStack o simile)
- [ ] Dominio su Cloudflare Registrar (nome da scegliere)
- [ ] GDPR minimo per beta pubblica: privacy policy, cancellazione account
      self-service (dati + foto), pagina termini, età 18+ dichiarata
- [ ] **Test:** l'app gira sul dominio pubblico da telefono; login Google ok;
      Sentry riceve un errore di prova; cancello un account di test e spariscono
      righe e foto

## 📱 Step 5 — App negli store (Capacitor + push)

- [ ] Wrapping Capacitor iOS/Android; deep link per il QR di check-in
- [ ] Push FCM: token dispositivo in tabella `push_tokens`; Edge Function che
      invia push su nuovo EV / match / messaggio (via DB webhook)
- [ ] Apple Developer (99$/anno): Sign in with Apple (obbligatorio a fianco di Google), build App Store
- [ ] Geolocalizzazione nativa per `venues_nearby`
- [ ] Store assets + requisiti review dating/UGC (block/report già fatti in 3h)
- [ ] **Test:** push ricevuta ad app chiusa per EV, match e messaggio; QR da
      fotocamera nativa apre l'app sul check-in

## 💳 Step 6 — Stripe

- [ ] Decisione: i drink li incassa la piattaforma o il locale (→ Stripe Connect)?
- [ ] PaymentIntent via Edge Function; webhook → `drinks.status=paid` (solo service role)
- [ ] **Test:** pagamento test → stato aggiornato solo dal webhook; il client
      non può forzare `paid` via API

---

## Trasversale (vale per ogni step)

- Loading/empty/error state su ogni vista collegata al DB (mai schermate mute)
- Niente segreti nel repo; scritture sensibili solo via RPC/service role
- Commit piccoli e messaggi chiari; ROADMAP aggiornata a ogni tappa
- Per i test a 2 utenti: creare 1–2 utenti di prova dal dashboard Supabase
  (Authentication → Add user) e usare una finestra in incognito
