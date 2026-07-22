# EveryWhere — Roadmap tecnica

Documento vivo: stato del progetto, percorso verso la produzione, debito
tecnico noto e decisioni prese. Si aggiorna a ogni tappa.

**Regola di lavoro:** niente si spunta finché il test non passa. Marco fa da
tester critico; chi implementa dichiara sempre *cosa ha verificato* e *cosa
resta da verificare*, senza dare per riuscito ciò che non ha provato.

> ⚠️ **Stato reale:** il codice è molto più avanti dei test. Quasi nulla di
> quanto costruito è stato validato su dati veri. La procedura completa,
> con passi e risultati attesi, è in **[TESTING.md](docs/TESTING.md)**: è la cosa
> più utile da fare adesso, prima di aggiungere altre funzioni.

---

## 1. Cos'è EveryWhere

App social basata sui locali. Chi è fisicamente a una serata può vedere le
altre persone presenti, mandare un "EV" (interesse), matchare, chattare e
offrire un drink. Lato business, i locali creano serate, generano QR e
comunicano col pubblico presente.

**Il ricavo viene dalle serate**, vendute come serata singola o abbonamento
con serate illimitate.

### Modello dati

```
piano (subscription | pay_per_night)
  └── locale (venues)
        └── serate (nights)          orari programmati + apertura/chiusura manuale
              └── QR (night_qr_codes) uno o più: ingresso, sale, zone
                    └── check-in (sessions)  registra da quale QR si è entrati

gruppo (groups)                    QR proprio, scade in 1h o con la serata
  └── membri (group_members)       visibilità: solo gruppo | singolo e gruppo
        entra in una serata e vi appare come un'unica entità (v. 3j)
```

### Stack

| Ambito | Scelta | Stato |
|---|---|---|
| Frontend | React + Vite + Tailwind + shadcn/ui | attivo |
| Backend | Supabase (Postgres, Auth, Realtime, Storage), regione EU | attivo (dev) |
| Hosting web | Cloudflare Pages | Step 4 |
| App store | Capacitor (iOS/Android) | Step 5 |
| Push | Firebase Cloud Messaging | Step 5 |
| Errori/uptime | Sentry + uptime monitor | Step 4 |
| Pagamenti | Stripe | Step 6 |

---

## 2. Principi non negoziabili

**Privacy — la regola centrale del prodotto**
Un profilo è visibile solo a: sé stessi, chi ha una sessione attiva **nella
stessa serata**, e i propri match. Non esiste modo di sfogliare gli utenti
dall'esterno. È implementata in `can_view_profile()` e riusata anche dalle
policy dello Storage: un solo punto da mantenere.

**Sicurezza**
- Ogni tabella ha RLS attiva. Il default è negare.
- Le scritture sensibili (check-in, EV, match, serate, QR) passano **solo**
  da funzioni RPC `security definer` che validano tutto lato server. Il
  client non può scegliere `owner_id`, token, stati di pagamento.
- I token dei QR sono generati dal server, mai dal client.
- Nessun segreto nel repo. La `anon key` è pubblica per progettazione: la
  sicurezza sta nelle RLS, non nella chiave.
- Ogni funzionalità nuova si testa anche **da avversario**: da anonimo, da
  utente non autorizzato, con input malformati.

**Qualità dell'esperienza**
- Ogni vista collegata al DB ha stato di caricamento, stato vuoto e stato di
  errore. Mai una schermata muta.
- I messaggi d'errore sono in italiano e dicono cosa fare, non cosa è
  fallito internamente.
- Le azioni distruttive (chiusura serata, rotazione QR, eliminazione)
  chiedono conferma e spiegano la conseguenza.
- L'app deve reggere una rete pessima: è pensata per locali affollati.

**Onestà verso l'utente**
Se un dato è dimostrativo, la UI lo dichiara. Mai numeri inventati presentati
come reali (vedi l'avviso sulla schermata Insight).

---

## 3. Stato attuale

### ✅ Completato

| Tappa | Contenuto |
|---|---|
| **1. Fondamenta** | Git, build riparata, piano auth e schema approvati |
| **2. Backend** | Supabase EU, 10+ tabelle, RLS verificata (anonimo = zero righe), Realtime, bucket privati, Base44 rimosso |
| **3a. Profilo** | Login → profilo reale in `profiles` → smistamento automatico; fix race su reload |
| **3b. Foto** | Upload su bucket privato, ricodifica client (rimuove EXIF/GPS), signed URL 1h con rinnovo, fallback inline |
| **3c-1. Locale** | `create_my_venue` atomica, gate di login, anagrafica completa persistita |
| **3c-2a. Dashboard** | QR reale stampabile, presenze reali, via il finto pagamento |
| **3c-3/4. Serate** | Serate con orari + override manuale, più QR per serata con finestre orarie, cambio sala senza perdere la sessione |
| **3c-5. Auth email** | Login/registrazione email+password, errori mappati per codice |
| **3d-1. Check-in** | `/checkin?t=<token>` con tutti gli stati, sessione reale che sopravvive al reload, uscita vera |

### ⏳ Da testare (implementato ma non ancora validato da Marco)

- Sicurezza lato business: anonimo respinto, token altrui, insert diretto con
  `owner_id` altrui, rotazione QR non propria, account già personale
- Serate: crea → QR inattivo → apri → funziona → chiudi → tutto spento
- Multi-QR: sale diverse si vedono tra loro, QR fuori finestra rifiutato,
  riscansione = cambio sala senza far ripartire il tempo
- Check-in: QR di serata aperta → dentro → reload → ancora dentro → esci
- Foto: un utente non in sessione/match non ottiene la signed URL (serve il
  secondo account, naturale in 3e)

### 🔧 Configurazioni Supabase da fare

- [ ] **dev:** Authentication → Providers → Email → disattivare "Confirm
      email" (oggi è attiva: la registrazione non logga subito e l'invio è
      limitato a poche email/ora)
- [ ] **prod:** riattivarla + SMTP proprio (Resend/Postmark/SES): il mailer
      integrato di Supabase non è per la produzione

---

## 3-bis. Cosa è rimasto in sospeso

Tutto ciò che è stato consapevolmente rimandato, in un unico posto.
"Quando serve" indica il momento oltre il quale diventa un problema.

### Pagamenti — l'intero Step 6 non esiste

È il pezzo più grande rimandato, e da lì viene il ricavo.

| Cosa manca | Nota | Quando serve |
|---|---|---|
| Incasso serate (singola e abbonamento) | `venues.plan` è salvato ma non fattura nulla | Prima di vendere a un locale vero |
| Controllo pagamento all'apertura serata | `open_night` **non** verifica `payment_status`: disattivato apposta, altrimenti nulla sarebbe testabile senza Stripe. Il punto esatto è già commentato nel codice | Con Stripe |
| Drink | Flusso disattivato con badge "Presto"; prima chiedeva dati di carta senza incassare | Quando decidi se incassa la piattaforma o il locale |
| Webhook Stripe | Gli stati di pagamento devono cambiare **solo** server-side | Con Stripe |
| Stripe Connect | Serve solo se i drink li incassa il locale | Dipende dalla decisione aperta |

### Blocchi alla beta pubblica 🔴

| Cosa manca | Perché blocca |
|---|---|
| **Recupero password** | Chi perde la password resta fuori per sempre. Farlo a metà (link che non porta da nessuna parte) sarebbe peggio che non averlo |
| **Cancellazione account** | Obbligo GDPR: deve eliminare righe **e** foto |
| **Privacy policy e termini** | L'app tratta posizione, foto e chat |
| **SMTP proprio** | Il mailer integrato di Supabase è limitato a poche email/ora: gli utenti veri non riceverebbero le conferme |
| **Conferma email in produzione** | Oggi va tenuta spenta in dev; in prod è obbligatoria |
| **Sentry** | Senza, gli errori degli utenti sono invisibili |
| **Backup verificati** | Non basta che siano attivi: va provato un restore |

### Funzioni incomplete

| Cosa | Stato |
|---|---|
| Scanner con fotocamera | Si incolla il codice, o si inquadra il QR con la fotocamera di sistema (funziona, il QR contiene l'URL) |
| Locali vicini | `venues.location` è sempre vuoto: serve il geocoding, altrimenti `venues_nearby()` non restituisce mai nulla |
| Insight dashboard | Dati dimostrativi, dichiarati in pagina |
| Logo e copertina del locale | Campi URL liberi, mai salvati: vanno sostituiti da upload su Storage |
| P.IVA e referente | Non persistiti: identità di fatturazione, arriva con Stripe |
| Coda di moderazione | Le segnalazioni si leggono dal dashboard Supabase; manca un ruolo staff |
| Paginazione | Chat, serate e ricordi caricano tutto: da paginare quando cresceranno |

### Qualità e infrastruttura

| Cosa | Stato |
|---|---|
| **Test automatici** | Zero. Da iniziare dalla logica pura: `nightState`, `qrState`, validazione token, mappatura errori |
| **CI** | Nessuna: lint, build e test dovrebbero girare a ogni push |
| Errori di lint | 12 aperti (import inutilizzati, eredità della demo) |
| Bundle | 1,14 MB in un chunk unico: manca il code splitting |
| N+1 dashboard serate | `fetchNightStats` viene chiamata una volta per serata |
| Deploy | Niente è ancora online: Cloudflare Pages, progetto Supabase di produzione, dominio |
| App native | Capacitor e push: Step 5 |

---

## 4. Percorso

### Step 3 — App funzionante con dati reali (in corso)

**✅ 3d-3 — QR di uscita e uscita volontaria** (implementato, da testare)
- [x] Un QR può essere di **ingresso** o di **uscita**: inquadrare quello di
      uscita chiude la sessione
- [x] Il QR di uscita **non rispetta finestre orarie** e funziona anche a
      serata chiusa: negare l'uscita non protegge nessuno
- [x] `check_in` ora dice cosa è successo (`checked_in` / `moved` /
      `checked_out`), con schermate distinte per ognuno
- [x] Si può eliminare l'unico QR di uscita, ma non l'unico di ingresso
      (renderebbe la serata irraggiungibile)
- [x] Lato utente: **"Esci dalla serata"** nel profilo, distinto dal logout.
      Prima l'unico modo per smettere di essere visibili era uscire dall'account
- [ ] **Test:** inquadro il QR di uscita → esco e non compaio più a chi resta;
      lo inquadro senza essere dentro → messaggio chiaro; "Esci dalla serata"
      lascia l'account attivo

**3d-2 — Scanner con fotocamera**
- [ ] Lettura QR dalla fotocamera in-app. Oggi funziona già inquadrando il QR
      con la fotocamera di sistema (il QR contiene l'URL completo) o
      incollando il codice
- [ ] Permesso negato, nessuna fotocamera, HTTPS richiesto dal browser
- [ ] **Test:** scansione reale da telefono; permesso negato → istruzioni
      chiare invece di schermata nera

**✅ 3e — Persone nella serata + EV + match** (implementato, da testare)
- [x] RPC `people_in_my_night()`: solo profili con sessione attiva nella mia
      serata, con `same_room` per distinguere chi è entrato dal mio stesso QR
- [x] `my_night_headcount()` per il conteggio in intestazione
- [x] Policy: i partecipanti leggono l'etichetta della propria sala, e le
      sessioni della propria serata (senza quest'ultima il Realtime non
      notificherebbe mai gli arrivi altrui, perché la RLS li nasconde)
- [x] **Correzione al modello:** gli EV erano unici per *locale*, retaggio di
      prima delle serate: due persone incontratesi in due serate diverse
      dello stesso locale non potevano rimandarsi un EV. Ora l'unità è la serata
- [x] `send_ev` riscritto su `active_session_night` + **limite 20 EV/minuto**
- [x] Pagina Sessione: persone reali divise tra "nella tua sala" e "altrove
      alla serata", con stati loading/vuoto/errore
- [x] Realtime su `sessions`, `evs`, `matches`: la lista resta viva
- [x] L'invio conferma solo dopo l'esito del server (prima dichiarava
      "inviato" comunque, anche in caso di errore)
- [x] EVPage e PersonDetail non toccati: stesse forme dati, sorgente reale
- [ ] **Test (2 account):** due utenti nella stessa serata si vedono; EV
      reciproco → match live su entrambi senza refresh; un terzo utente fuori
      dalla serata non vede nessuno; chi è in un'altra sala si vede comunque;
      il limite anti-spam scatta al 21° EV in un minuto

**✅ 3f — Chat reale** (implementato, da testare)
- [x] Chat su `messages` + Realtime, solo dentro un match; una sola query
      carica i messaggi di tutti i match
- [x] Invio reale: il messaggio compare solo se il server lo accetta, e il
      testo resta nel campo se l'invio fallisce
- [x] Deduplica: lo stesso messaggio arriva sia dall'insert sia dal Realtime
- [x] Validazione lato client (vuoto, soli spazi, oltre 2000 caratteri)
- [x] **Corretta una frase falsa nella UI:** diceva "questa chat è temporanea
      e scade con la sessione, non sarà accessibile dopo", ma i messaggi
      restano legati al match. Ora dichiara il comportamento vero
      (v. decisione aperta sulla durata delle conversazioni)
- [ ] **Test (2 account):** messaggi live nei due sensi senza refresh; la
      chat sopravvive al reload; un estraneo non li legge nemmeno via API
- [ ] Paginazione dei messaggi quando le conversazioni si allungano

**✅ 3g-1 — Comunicazioni del locale** (implementato, da testare)
- [x] Pagina Locale: `venue_messages` reali + Realtime (compaiono senza
      ricaricare) e stato vuoto al posto della schermata muta
- [x] Dashboard: CRUD reale (prima il form diceva "inviata" senza salvare):
      pubblica, metti/togli evidenza, elimina, con elenco delle pubblicate
- [x] **Risolto D4:** i tipi ora combaciano (promo, lineup, info, event);
      prima la UI ne offriva 4 e il DB ne accettava 2
- [x] Messaggi indirizzabili a una serata specifica o a tutto il locale
- [x] Le scritture passano da RPC: la policy diretta permetteva di allegare
      un messaggio alla serata di un ALTRO locale (controllava solo il venue)
- [ ] **Test:** pubblico dalla dashboard → compare a chi è in sessione senza
      ricaricare; un messaggio legato a una serata non si vede da un'altra;
      elimina e "in evidenza" funzionano

**✅ 3g-2a — Ricordi reali** (implementato, da testare)
- [x] RPC `my_memories()` (le persone con cui ho un match, con locale,
      serata e data) e `my_night_recaps()` (le serate a cui ho partecipato,
      con EV inviati/ricevuti e match)
- [x] Nessuna tabella nuova: i numeri si derivano da `sessions` + `evs` +
      `matches`, così non c'è nulla da tenere sincronizzato
- [x] I ricordi si consultano anche fuori sessione (non servono serate in corso)
- [x] Un nuovo match aggiorna i ricordi in tempo reale
- [x] Rimossi gli annunci di eventi futuri completamente inventati
      (locali, date e immagini di repertorio)
- [x] Stati loading / vuoto / errore su entrambe le schede
- [x] **`AppContext` non contiene più alcun dato finto**
- [ ] **Test:** dopo un match la persona compare in "Conosciuti"; la serata
      compare in "Serate" coi conteggi giusti; senza dati si vedono gli
      stati vuoti e non schermate mute

**✅ 3g-2b — Drink: disattivato onestamente** (implementato)
- [x] **Deciso:** niente flusso finto. Il modale chiedeva numero di carta,
      scadenza e CVV, mostrava importi inventati (€9 + €1) e dichiarava
      "Drink offerto!" senza che accadesse nulla
- [x] La voce resta visibile con badge "Presto" e la spiegazione che
      arriverà coi pagamenti in-app: nessun dato di pagamento viene chiesto
- [x] Rimosso lo stato simulato (`sendDrink`, `confirmDrinkPayment`,
      `drinkNotifications`)
- [ ] Riattivazione allo **Step 6** con Stripe e stato `pending_payment`
- [ ] Nota: le foto dei locali non esistono ancora (debito D5), quindi le
      card di Ricordi usano un fondo grafico invece di immagini inventate

> **Step 3 completato per i dati:** nessuna schermata dell'app mostra più
> contenuti inventati. Resta dimostrativa solo la pagina Insight della
> dashboard, che però lo dichiara.

**✅ 3h — Blocco e segnalazione** (implementato, da testare)
- [x] Tabelle `blocks` e `reports` (6 motivi, dettagli facoltativi)
- [x] Il blocco è **simmetrico negli effetti**: chi blocca e chi è bloccato
      spariscono a vicenda da liste, profili, foto, match, chat ed EV —
      applicato dentro `can_view_profile()`, quindi vale anche via API
- [x] Un blocco **batte il match**: non basta nascondere la lista, si chiude
      anche l'accesso al profilo e alla conversazione
- [x] Non si può sapere di essere stati bloccati (`blocks` è leggibile solo
      da chi ha creato il blocco): saperlo esporrebbe a ritorsioni
- [x] Segnalare blocca automaticamente: chi segnala non resta esposto
- [x] UI: pannello da "⋯" nella scheda persona; elenco "Persone bloccate"
      nel profilo, con sblocco
- [x] Scritture solo via RPC
- [ ] **Coda di moderazione**: per ora si consulta dal dashboard Supabase
      (`select * from reports where status = 'open'`). Serve un ruolo staff
      prima di avere volumi veri
- [ ] **Test (2 account):** blocco → sparisce da entrambe le liste anche
      nella stessa serata; la chat non è più leggibile nemmeno via API;
      segnalazione registrata in `reports`; sblocco dal profilo
> Apple e Google **rifiutano** le app social/UGC senza blocco e segnalazione.

**3i — Geocoding** (serve solo per "locali vicini")
- [ ] `venues.location` è sempre `null`, quindi `venues_nearby()` non
      restituisce mai nulla: i locali esistono ma sono invisibili alla
      ricerca per vicinanza
- [ ] Convertire `city + address` in coordinate (Nominatim/OSM via Edge
      Function, oppure inserimento manuale dalla dashboard)

**3j — Partecipazione in gruppo** (in corso, spezzata in sotto-tappe)

Un insieme di persone può presentarsi alla serata come **un'unica entità**.
Serve, ad esempio, a chi non vuole ricevere EV da singolo ma è disposto ad
accogliere qualcuno *nel* gruppo. La feature è la più invasiva del progetto
(tocca visibilità, presenza, EV e — soprattutto — il modello match/chat a due
utenti, **D13**): per questo è divisa in quattro bricchi indipendenti.

**✅ 3j-1 — Fondazione del gruppo** (implementato in
`supabase/migrations/20260722_groups.sql`, **da applicare e testare**)
- [x] Tabelle `groups` (leader, `night_id` nullable, `status`, `expires_at`,
      `entered_night_at`, `dissolved_at`), `group_qr_tokens` (token generato
      dal server, come i QR serata) e `group_members` (`visibility`,
      `is_leader`). RLS attiva, **scritture solo via RPC** `security definer`
- [x] RPC: `create_group`, `join_group`, `leave_group`,
      `transfer_leadership`, `set_group_visibility`, `set_group_display`,
      `enter_night_as_group`, `dissolve_group`, `my_group`
- [x] **Vitalità derivata, non memorizzata** (`is_group_active`): forming ⇒
      entro 1h; in_night ⇒ finché la serata è aperta. Così alla chiusura della
      serata il gruppo decade **da solo** e **non è stato necessario toccare**
      `close_night` / `end_session` / `check_in` (nessuna RPC testata modificata)
- [x] Capogruppo che lascia ⇒ **leadership al membro più anziano**; ultimo che
      resta ⇒ gruppo sciolto. Un utente in **un solo gruppo attivo**; **max 8**
- [x] Unica modifica a codice esistente: aggiunta **additiva** a
      `can_view_profile` (`in_same_active_group`), così i co-membri si vedono
      anche mentre il gruppo si sta formando fuori serata
- [x] RLS senza ricorsione: le policy usano l'helper `is_group_member`
      (`security definer`), non una subquery sulla stessa tabella
- [x] Realtime su `groups` e `group_members`
- [ ] **Non applicata su Supabase** (nessun Postgres locale per validarla):
      Marco la esegue nell'SQL editor
- [ ] **Test (SQL, 2-3 account):** creo gruppo → `my_group` lo mostra; secondo
      account entra col token; un terzo non membro non legge né `groups` né
      `group_members` (RLS); `join` bloccato se già in un gruppo, se pieno (9°),
      se token errato; capogruppo `leave` → leadership trasferita; ultimo
      `leave` → sciolto; gruppo forming dopo 1h risulta inattivo; agganciato a
      una serata e poi serata chiusa ⇒ inattivo senza job

**✅ 3j-1b — Uscita dalla serata = uscita dal gruppo** (implementato in
`supabase/migrations/20260722_groups_exit.sql`, **da applicare e testare**)
- [x] **Deciso:** chi esce dalla serata (QR di uscita o "Esci dalla serata")
      lascia **solo sé stesso** dal gruppo; il gruppo prosegue. Capo che esce
      ⇒ leadership al più anziano; ultimo che esce ⇒ sciolto
- [x] Realizzato con un **trigger** su `sessions` (transizione `ended_at`
      null→valorizzato), **non** riscrivendo `check_in`/`end_session`: vale per
      ogni percorso di uscita, `close_night` compreso, senza toccare RPC testate
- [x] Ambito: rimuove solo da un gruppo `in_night` **legato a quella serata**;
      un gruppo ancora `forming` non è toccato
- [ ] **Test:** in serata, un non-capo esce → sparisce dal gruppo, gli altri
      restano; il capo esce → leadership trasferita; esce l'ultimo → sciolto;
      la chiusura serata scioglie il gruppo

**✅ 3j-2 — Presenza del gruppo nella serata** (implementato in
`supabase/migrations/20260722_groups_presence.sql`, **da applicare e testare**)
- [x] `people_in_my_night()` v3: parte dalla 3h (filtro blocchi) ed **esclude
      i membri "solo gruppo"** come individui; i "singolo e gruppo" restano
- [x] `groups_in_my_night()`: i gruppi `in_night` della mia serata come entità
      uniche, coi soli membri effettivamente presenti (sessione attiva) e non
      bloccati; nasconde il mio stesso gruppo
- [x] `send_ev` v3: parte dalla 3e e **rifiuta** un EV verso un "solo gruppo"
      (`receiver_group_only`); l'interesse passa dall'EV al gruppo (3j-4)
- [x] La foto del gruppo: override `photo_path` oppure cluster degli avatar dei
      membri composto lato client (niente immagine finta)
- [ ] Esclusione dai **drink** a livello di RPC: rimandata allo Step 6 (il
      flusso drink oggi non esiste)
- [ ] **Test:** il gruppo appare come entità singola a un terzo; un "solo
      gruppo" non compare come individuo e `send_ev` lo rifiuta anche via API

**✅ 3j-3 — Frontend crea/entra/gestisci** (implementato, **da testare**)
- [x] `GroupContext` (stato gruppo + gruppi in serata + EV di gruppo + chat,
      con realtime) e `src/api/groups.js`
- [x] Pagina `/group` (`GroupHub`): crea/entra, QR d'invito (`qrcode.react`),
      countdown 1h in formazione, lista membri live con corona del capo,
      toggle visibilità, "rendi capo", "porta il gruppo in serata", esci/sciogli
- [x] Pagina `/join-group?g=<token>` (`JoinGroup`): ingresso via QR, con stati
      accesso-richiesto/errore; si accetta anche il token incollato
- [x] Ingressi da Home ("Crea o entra in un gruppo") e banner in `Session`
- [x] Card dei gruppi presenti nel feed della serata, con "EV al gruppo"
- [x] Build e lint puliti; pagine renderizzate senza errori in console
- [ ] **Test (loggato):** creo gruppo → QR → 2° account entra; countdown;
      cambio visibilità; trasferimento leadership; uscita

**✅ 3j-4 — Chat di gruppo (D13)** (implementato in
`supabase/migrations/20260722_groups_chat.sql`, **da applicare e testare**)
- [x] **Scelta:** niente stravolgimento del match/chat 1:1 (già testato). Un
      **sistema parallelo**: `group_evs` → `group_matches` → `group_messages`,
      con RLS, realtime e RPC dedicate
- [x] EV verso il gruppo (`send_group_ev`, stesso freno anti-spam); **qualsiasi
      membro accetta** (`accept_group_ev`) → nasce la conversazione condivisa;
      `send_group_message` aperta a tutti i partecipanti (singolo + membri)
- [x] Frontend: EV al gruppo dal feed, EV in arrivo (accetta/ignora) e chat
      condivisa nel `GroupHub`, con realtime
- [ ] **Test (più account):** EV al gruppo → un membro accetta → tutti i membri
      e il mittente vedono e scrivono nella stessa chat; un estraneo non la legge

**✅ 3k — Badge e gameability** (implementato in
`supabase/migrations/20260722_badges.sql`, **da applicare e testare**)
- [x] Backend: `count_nights_attended` / `count_drinks_offered` /
      `count_matches` (derivati, come i Ricordi: nessuna tabella da
      sincronizzare), `my_stats()` per il profilo, e
      `night_participants_with_stats(p_night)` per il locale (solo l'owner
      della serata)
- [x] Catalogo badge nel **frontend** (`src/lib/badges.js`), un solo posto:
      **serate** (10/50/100), **drink** (20/40/80), **match** (5/25/50), con
      soglie/nomi/emoji. I conteggi vengono dal backend
- [x] Profilo: sezione **"Riconoscimenti"** (badge sbloccati + progresso)
- [x] Dashboard locale: pulsante **"Partecipanti e badge"** sulla serata in
      corso → elenco dei partecipanti (presenti/usciti) coi badge sbloccati
- [x] Build e lint puliti (rimossi anche 2 import morti pre-esistenti)
- [ ] **Drink a 0** finché non esiste il flusso drink (**Step 6**): la
      funzione conta già `drinks` in stato `paid`/`redeemed`
- [ ] ⚠️ **Privacy (debito D14):** il locale ora vede **identità + badge** dei
      partecipanti delle SUE serate (prima solo conteggi). Va **dichiarato
      nell'informativa** e resta aperto se renderlo **opt-in** per l'utente
- [ ] **Test:** raggiunta una soglia il badge compare a me e, nella dashboard,
      al locale organizzatore; un locale **diverso** non ottiene righe
      (`not_venue_owner`); i conteggi combaciano coi dati reali

**✅ 3l — Fix di layout: overlay coperti dalla bottom nav** (implementato, da testare da loggato)
- [x] La barra di testo della **chat** (dopo il match) era irraggiungibile:
      il `ChatModal` era `z-50`, **identico** alla `BottomNav`, che viene
      renderizzata dopo nel DOM e vinceva lo stacking coprendo la parte bassa
- [x] Stesso difetto su **modifica profilo**, **impostazioni** (drawer) e
      **persone bloccate**
- [x] Alzati gli overlay sopra la nav: `z-[60]` (drawer impostazioni con
      sfondo `z-[55]`). La nav resta `z-50`
- [x] Verificato: build e caricamento senza errori in console
- [ ] **Test (da loggato):** in un match la barra chat è raggiungibile e sopra
      la nav; il pulsante "Salva" in modifica profilo non è più coperto; tutte
      le righe del drawer Impostazioni sono cliccabili

### Gate — prima di far entrare utenti veri

Da completare **tutti** prima di aprire a persone che non conosci:

- [ ] Recupero password (pagina che gestisce il link `type=recovery`)
- [ ] Blocco e segnalazione (3h)
- [ ] Cancellazione account self-service: righe **e** foto
- [ ] Privacy policy, termini, informativa sui dati di posizione
- [ ] Conferma email attiva + SMTP proprio
- [ ] Sentry attivo, così gli errori si vedono
- [ ] Backup del database verificati (non solo attivi: provati)

### Step 4 — Online: deploy, monitoraggio, conformità

- [ ] Repo GitHub + Cloudflare Pages (prod da `main`, preview per branch,
      redirect SPA)
- [ ] Progetto Supabase **prod** separato, stessa migration, env distinte
- [ ] Google OAuth: consent screen fuori da "Testing", redirect URL di prod
- [ ] Sentry (frontend) + uptime monitor
- [ ] Dominio su Cloudflare Registrar
- [ ] **Test:** l'app gira sul dominio pubblico da telefono; Sentry riceve un
      errore di prova; cancello un account di test e spariscono righe e foto

### Step 5 — App negli store

- [ ] Capacitor iOS/Android; deep link `/checkin?t=` dal QR
- [ ] Push FCM: tabella `push_tokens`, Edge Function su nuovo EV / match /
      messaggio
- [ ] Apple Developer (99$/anno) → Sign in with Apple (obbligatorio se offri
      altri login social) + build App Store
- [ ] Geolocalizzazione nativa
- [ ] Asset store e requisiti review per app di incontri/UGC
- [ ] **Test:** push ricevuta ad app chiusa; QR da fotocamera nativa apre
      l'app sul check-in

### Step 6 — Stripe

- [ ] `open_night` pretende `payment_status in ('paid','waived')` — il
      controllo è già previsto nel codice, oggi disattivato per poter testare
- [ ] Abbonamento locale + acquisto serata singola
- [ ] PaymentIntent via Edge Function; webhook → stato aggiornato **solo**
      con service role
- [ ] **Test:** il client non può forzare `paid` via API; pagamento di prova
      aggiorna lo stato solo tramite webhook

**Drink — modello deciso** *(v. studio in §10)*
- [ ] **La piattaforma è merchant of record:** incassa lei il pagamento
      dell'utente (prezzo drink + sovrapprezzo). **Niente Stripe Connect**:
      serve solo se il denaro andasse direttamente al locale
- [ ] Flusso: utente offre drink → PaymentIntent → stato `pending_payment`
      → webhook → `paid`. Il drink pagato entra in una **coda "da servire"**
      sulla dashboard del locale (nome/tavolo o codice di ritiro), con notifica
- [ ] Fine serata: **rendiconto automatico** (N drink × prezzo concordato).
      ⚠️ **Non** è una fattura emessa per conto del locale: è la base con cui
      **il locale fattura alla nostra società** i drink erogati. Emettere
      fattura al posto del locale (autofattura) richiede un accordo esplicito
      a contratto
- [ ] Ricavo = sovrapprezzo (differenza tra incasso dall'utente e costo
      concordato col locale)
- [ ] I **gruppi** sono esclusi dai drink, a livello di RPC (v. 3j)
- [ ] **Attriti da validare con un locale-pilota:** il barista deve vedere
      l'ordine già pagato in una serata caotica (MVP = dashboard + suono, non
      integrazione col loro POS); il locale eroga stasera ma incassa da noi
      dopo (tempi di pagamento da definire, v. Decisioni aperte)

---

## 5. Tracce trasversali

### Sicurezza

- [x] **Rate limiting su `send_ev`**: 20 EV al minuto per utente (3e)
- [ ] Valutare limiti anche su messaggi e segnalazioni
- [ ] Verifica che un utente non possa entrare in due serate insieme
      (l'indice unico c'è, va testato)
- [ ] Revisione periodica delle policy: ogni tabella nuova nasce con RLS
- [ ] Rotazione della `anon key` documentata (procedura, non solo teoria)
- [ ] Nessun dato personale nei log di Sentry (foto, chat, posizione)

### Scalabilità

- [ ] **N+1 nella dashboard serate**: `fetchNightStats` viene chiamata una
      volta per serata. Con molte serate diventa lento → aggregare in una
      sola query o RPC
- [ ] Paginazione su liste che cresceranno (serate, memories, chat)
- [ ] **Bundle da 1,14 MB** (321 KB gzip) in un unico chunk: code splitting
      per rotta, pesano soprattutto recharts e framer-motion
- [ ] Limiti Realtime: quante connessioni simultanee regge il piano scelto
- [ ] Indici: verificare i piani di esecuzione quando le sessioni cresceranno

### Qualità e test

- [ ] **Non esiste un solo test automatico.** Priorità: la logica pura e
      critica — `nightState`/`qrState`, validazione token, mappatura errori
- [ ] Test d'integrazione sulle RPC (i casi da avversario, oggi fatti a mano)
- [ ] CI su GitHub Actions: lint + build + test a ogni push
- [ ] **14 errori di lint** aperti (import inutilizzati, eredità della demo)
- [x] Error boundary React attivo (verificato provocando un errore vero);
      è anche il punto in cui agganciare Sentry allo Step 4
- [ ] Accessibilità: contrasti, focus, `aria-label` sui bottoni-icona

### Operatività

- [ ] Backup Supabase: capire cosa copre il piano e **provare un restore**
- [ ] Ambienti dev e prod separati anche per Google OAuth e Stripe
- [ ] Runbook minimo: cosa fare se il DB è giù durante una serata
- [ ] Monitoraggio costi (Supabase, Cloudflare) con soglia di allerta

### Conformità (GDPR + store)

- [ ] Base giuridica e informativa per: posizione, foto, chat
- [ ] Diritto all'oblio: cancellazione completa e verificata
- [ ] Esportazione dati su richiesta
- [ ] Età minima 18 anni: oggi **dichiarata** dall'utente, non verificata
- [ ] Conservazione dei dati: per quanto tempo restano chat e sessioni?
- [ ] Moderazione delle foto (Apple lo chiede per le app con UGC)

---

## 6. Registro del debito tecnico

Cose consapevolmente lasciate indietro, con il perché.

| # | Debito | Perché esiste | Impatto |
|---|---|---|---|
| ~~D1~~ | ~~Dati finti in `AppContext`~~ | **Risolto**: `MOCK_PEOPLE` (3e), `MOCK_VENUE_MESSAGES` (3g-1), `MOCK_MEMORIES` e `MOCK_EVENTS` (3g-2a). Resta finto solo il modale drink | — |
| D2 | Modalità ospite | Serviva per navigare la demo senza login | Medio: va rimossa o confinata, oggi crea stati ibridi |
| D3 | Schermata Insight con dati inventati | Le statistiche reali richiedono aggregazioni | Basso: la UI lo dichiara |
| ~~D4~~ | ~~Comunicazioni: UI 4 categorie, DB 2~~ | **Risolto in 3g-1**: tipi allineati (promo, lineup, info, event) | — |
| D5 | Logo e copertina del locale come URL liberi | Servirebbe upload su Storage | Medio: accettare URL arbitrari da mostrare è una porta aperta |
| D6 | P.IVA e referente non persistiti | Identità di fatturazione, arriva con Stripe | Basso |
| D7 | Etichetta della sala invisibile ai partecipanti | `night_qr_codes` è leggibile solo dall'owner | Medio: blocca "in che sala sei" |
| D8 | Recupero password assente | Farlo a metà sarebbe peggio che non averlo | **Alto: blocca la beta pubblica** |
| D9 | Nessun test automatico | Velocità nelle fasi iniziali | Alto e crescente |
| D10 | Bundle unico da 1,14 MB | Nessun code splitting | Medio: prima apertura lenta in 3G |
| D11 | Geocoding assente | Rimandato | Basso finché non serve "locali vicini" |
| ~~D12~~ | ~~Nessun error boundary~~ | **Risolto**: `ErrorBoundary` attorno all'app, verificato con un guasto reale | — |
| ~~D13~~ | ~~Chat/match a due utenti, non predisposti ai gruppi~~ | **Risolto in 3j-4** con un sistema parallelo (`group_evs`/`group_matches`/`group_messages`): il match 1:1 resta intatto | — |
| D14 | Il locale vede solo conteggi, non identità | Modello di privacy attuale (§2) | Medio: la 3k vuole mostrargli partecipanti e badge → serve informativa/opt-in |

---

## 7. Decisioni prese

| Data | Decisione | Motivo |
|---|---|---|
| Step 1 | Migrare da Base44 a Supabase | Nessun backend reale da migrare, libertà di architettura, Postgres esportabile |
| Step 2 | Visibilità profili ancorata alla presenza | È il cuore del prodotto e della privacy |
| Step 3c | Le serate sono l'entità che si vende | Il ricavo viene da lì: serve un'entità da fatturare |
| Step 3c-4 | Più QR per serata, con finestre orarie | Una festa ha più punti d'ingresso (sale, zone) |
| Step 3c-4 | Chi entra da QR diversi della stessa serata si vede | È la stessa festa; i QR sono punti di distribuzione |
| Step 3c-4 | Riscansione = cambio sala, non nuova sessione | L'orario d'ingresso deve restare quello vero |
| Step 3c-4 | Più serate aperte per locale ammesse | Richiesto: eventi paralleli |
| Step 3c-5 | Email+password è un login reale (prima era solo per i test) | Riduce l'attrito e semplifica i test a più account |
| Step 3d | Il QR contiene un URL, non un token nudo | Funziona con la fotocamera di sistema ed è pronto per i deep link |
| Step 3j | Il gruppo appare come un unico utente, con chat condivisa | È la promessa del prodotto: presentarsi insieme, non come singoli |
| Step 3j | La leadership del gruppo è trasferibile, non fissa | Un membro non deve poter far cadere il gruppo uscendo |
| Step 3j | Uscire dalla serata fa lasciare il gruppo solo a chi esce | Coerente con la leadership trasferibile; il gruppo resta vivo per gli altri |
| Step 3j-1 | Vitalità del gruppo derivata, non memorizzata | Come sessioni e ricordi: alla chiusura serata il gruppo decade da sé, senza toccare `close_night` |
| Step 3k | I badge li vedono l'utente e il locale organizzatore | Richiesto: dà al locale visibilità sul pubblico; con riserva privacy |
| Step 6 | I drink li incassa la piattaforma (merchant of record), niente Connect | Controllo del flusso e del margine; il locale fattura a noi i drink erogati |

## 8. Decisioni aperte

- **Drink** *(chi incassa: risolto — la piattaforma)*: restano aperti il
  **sovrapprezzo**, i **tempi di pagamento al locale**, e se mettere a
  contratto l'**autofattura** (emettere noi la fattura per conto del locale).
  Da validare con un locale-pilota.
- **Gruppi — limiti** *(già a default nel codice, confermabili)*: un utente in
  **un solo gruppo attivo**, **max 8 membri**. Cambiarli è un punto solo.
- **Badge visibili al locale**: renderlo **opt-in** per l'utente? Fin dove
  arriva ciò che il locale vede del pubblico (solo badge, o anche profili)?
  Tocca la promessa di privacy, va deciso prima di esporlo.
- **Prezzi**: quanto costano serata singola e abbonamento.
- **Verifica dell'età**: solo dichiarata o verificata davvero? Cambia molto
  sul piano legale per un'app con incontri.
- **Durata delle conversazioni** *(emersa in 3f)*: la UI prometteva chat
  effimere che scadevano con la serata, ma i messaggi restano legati al
  match. Ho allineato il testo alla realtà, ma la scelta di prodotto è
  aperta: chat permanenti con i match (come ora), oppure effimere davvero
  (con cancellazione a fine serata). Cambia la promessa di privacy fatta
  all'utente, quindi va decisa prima della beta.
- **Conservazione dati**: per quanto restano chat, sessioni e memories.
- **Nome e dominio**: ancora da scegliere.

---

## 9. Convenzioni di lavoro

- Modifiche piccole e reversibili; commit dedicato per ogni tappa
- Oltre ~5 file toccati insieme: avvisare prima
- Ogni migration è additiva e idempotente dove possibile; non si riscrive
  una migration già applicata
- Dopo ogni tappa: cosa ho verificato io / cosa devi verificare tu, con i
  passi esatti
- Per i test a due utenti: Supabase → Authentication → Add user, oppure
  registrazione email+password, e una finestra in incognito

---

## 10. Studio: come funzionano i drink offerti

*Ha senso? È attuabile? I locali sono ben disposti?* Sintesi della decisione
presa (v. §7 e Step 6).

**Modello scelto — la piattaforma incassa.** L'utente offre un drink e paga
in app (prezzo + sovrapprezzo): l'incasso arriva a noi, non al locale. La
piattaforma diventa *merchant of record*. È lo schema più pulito: controlliamo
flusso, dati e margine, e ci prendiamo noi il rischio di credito verso
l'utente. Stesso principio di Glovo/JustEat lato ristorante.

**È attuabile con Stripe standard — niente Connect.** Connect servirebbe solo
se il denaro dovesse arrivare *direttamente* sul conto del locale. Qui incassa
la piattaforma e paga il locale a parte, quindi basta Stripe standard:
`PaymentIntent` → `pending_payment` → webhook → `paid`, drink in coda "da
servire" sulla dashboard del locale.

**Il punto delicato è fiscale, non tecnico.** Il "documento automatico" non è
una fattura che emettiamo *per conto del locale*. Il giro corretto è:
1. l'utente paga a noi → **noi emettiamo ricevuta/fattura all'utente** (IVA
   inclusa);
2. il locale ci ha "venduto all'ingrosso" i drink erogati → **il locale
   emette fattura verso la nostra società** per il costo concordato;
3. la differenza è il nostro margine.
Il sistema può generare un **rendiconto** (N drink × prezzo) che il locale usa
come base per *la sua* fattura. Emettere la fattura al posto del locale
(autofattura) è possibile ma va messo a contratto.

**I locali sono ben disposti? Dipende da due attriti concreti.**
- **Operatività al bancone:** il barista deve vedere l'ordine e sapere che è
  già pagato, in una serata caotica. Senza integrazione col loro POS è un
  secondo schermo da guardare. MVP realistico: la dashboard che già esiste,
  con coda e notifica sonora.
- **Tempi d'incasso:** loro erogano stasera e incassano da noi dopo (su
  fattura). Ai locali piace incassare subito: vanno garantiti pagamenti rapidi
  e affidabili.

**Il gancio di vendita per il locale:** consumazioni extra a costo di
acquisizione zero (un drink offerto = due persone al bancone invece di una) e
nessun rischio di credito verso l'utente. Con questo framing molti sono ben
disposti — ma **serve un locale-pilota** per validare attriti e tempi prima di
generalizzare.

---

## 11. 🔮 Feature Backlog & Engagement Strategies (Post-MVP)

> ⚠️ **Idee in valutazione da parte del Board — NON implementare nell'MVP.**
> Questa sezione raccoglie proposte pensate per **abbattere l'attrito
> psicologico dell'interazione dal vivo** (paura del rifiuto, blocco da
> schermo bianco, distanza fra match digitale e incontro fisico). Sono
> deliberatamente **fuori dallo scope dell'attuale MVP**: la priorità resta
> **validare il core-loop `Scan → View → EV`** su dati veri (v. §3 e §4).
> Nessuna di queste va costruita finché il core-loop non è validato, per non
> disperdere il focus.

**Come leggere questa lista.** Sono spunti di prodotto, non impegni: mancano
progettazione dati, verifiche di sicurezza/RLS e conferma di sostenibilità
(v. §2). Diverse toccano la **promessa di privacy** e vanno perciò allineate
con le Decisioni aperte (§8) e con il registro del debito (§6) prima di
diventare tappe vere.

| # | Idea | Attrito che risolve | Nota implementativa (a monte) |
|---|---|---|---|
| B1 | Scarcity & FOMO (limite EV) | Il gesto vale poco se è illimitato | Limite lato server (come `send_ev`), non solo UI |
| B2 | Icebreakers guidati | Blocco da schermo bianco | Richiede i Topic in comune già esposti |
| B3 | Micro-stati di localizzazione | Distanza fra match e incontro fisico | Nuovo campo di stato sul profilo/sessione, effimero |
| B4 | "Match & Claim" (phygital) | Passività: nessun motivo per muoversi | Serve il locale come attore + drop promozionali |
| B5 | Digital Wingman (EV per procura) | Paura del rifiuto in prima persona | Dipende dai gruppi (§3j) e dalla social proof |

### B1 — Scarcity & FOMO (limite EV)

Limitare il numero di **EV a disposizione per sessione** (es. **massimo 3**)
per aumentare il **valore percepito** del gesto e spingere l'utente a
un'azione **ponderata** anziché a un invio a tappeto. A completamento,
**notifiche di countdown** verso la fine della serata ("restano pochi EV",
"la serata sta per chiudere") per innescare l'urgenza nel momento giusto.

- Da studiare: il limite va applicato **lato server** (come l'attuale rate
  limit di `send_ev`, §5), non solo in UI, altrimenti è aggirabile via API.
- Tensione da risolvere: un tetto troppo basso può frenare l'attività iniziale
  quando i volumi sono ancora sottili. Numero da tarare, non da fissare a priori.

### B2 — Icebreakers guidati

Fornire **frasi pre-compilate** — ironiche o contestuali — al momento
dell'invio di un EV, generate a partire dai **Topic (interessi) in comune**,
per sconfiggere il **blocco da schermo bianco**.

- Prerequisito: gli interessi condivisi devono già essere calcolati ed esposti
  (oggi non è un dato di primo piano nel flusso EV).
- Nessun testo va **inviato per conto dell'utente** senza sua conferma
  esplicita: le frasi sono suggerimenti da editare, non invii automatici.

### B3 — Micro-stati di localizzazione

Aggiungere al profilo un **tag di stato rapido ed effimero** che dice *dove
sei nel locale* — es. 📍 Al Bancone, 📍 Area Fumatori, 📍 Pista — per
facilitare il passaggio dal **match digitale all'incontro fisico**.

- È un dato **volatile**, legato alla sessione: va azzerato all'uscita e non
  deve diventare uno storico di spostamenti (v. §2, minimizzazione dei dati).
- Toccando la posizione fisica dell'utente **dentro** il locale, va pesato
  rispetto alla privacy e all'informativa.

### B4 — Dinamica "Match & Claim" (gamification phygital)

Dare al **locale** la possibilità di lanciare **"Drop" promozionali** (es.
2×1 sui drink). L'app assegna **metà di un QR code** a un utente e **l'altra
metà** a un altro utente casuale presenti alla serata: i due devono
**trovarsi fisicamente** per ricomporre il codice e **validare lo sconto al
bancone**.

- Introduce il **locale come attore attivo** della meccanica di gioco e si
  appoggia al flusso drink (**Step 6**), quindi è a valle dei pagamenti.
- Rischi da gestire: abbinamenti che non si incontrano (drop "morti"),
  possibili abusi, e la validazione al bancone che si intreccia con la coda
  "da servire" (§4, Step 6).

### B5 — Il "Digital Wingman" (amico spalla)

Introdurre l'**"EV per procura"**: un utente può inviare un EV **per conto di
un amico** presente nello **stesso gruppo**, sfruttando l'**ironia** e la
**social proof** per **azzerare la paura del rifiuto** (non ti esponi tu, ti
espone l'amico).

- Dipende direttamente dalla **partecipazione in gruppo (§3j)** e dai suoi
  nodi ancora aperti (chat di gruppo, debito **D13**).
- Da chiarire il **consenso**: l'EV inviato a nome di un altro deve essere
  tracciabile e, verosimilmente, autorizzato dal diretto interessato, per non
  trasformare la spalla in spam.
