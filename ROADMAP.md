# EveryWhere — Roadmap tecnica

Documento vivo: stato del progetto, percorso verso la produzione, debito
tecnico noto e decisioni prese. Si aggiorna a ogni tappa.

**Regola di lavoro:** niente si spunta finché il test non passa. Marco fa da
tester critico; chi implementa dichiara sempre *cosa ha verificato* e *cosa
resta da verificare*, senza dare per riuscito ciò che non ha provato.

> ⚠️ **Stato reale:** il codice è molto più avanti dei test. Quasi nulla di
> quanto costruito è stato validato su dati veri. La procedura completa,
> con passi e risultati attesi, è in **[TESTING.md](TESTING.md)**: è la cosa
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
- [ ] Drink: **decisione aperta**, incassa la piattaforma o il locale?
      (il secondo caso richiede Stripe Connect)
- [ ] PaymentIntent via Edge Function; webhook → stato aggiornato **solo**
      con service role
- [ ] **Test:** il client non può forzare `paid` via API; pagamento di prova
      aggiorna lo stato solo tramite webhook

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

## 8. Decisioni aperte

- **Drink**: incassa la piattaforma o il locale? (Stripe Connect nel secondo
  caso). Serve prima dello Step 6.
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
