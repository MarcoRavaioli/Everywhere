# EveryWhere — Guida ai test

Il codice è più avanti dei test: quasi tutto quello che è stato costruito
non è ancora stato validato su dati veri. Questo documento serve a colmare
quel divario in modo ordinato.

**Come si legge:** ogni test dice *cosa verifica*, *i passi* e *cosa deve
succedere*. Se il risultato è diverso da quello atteso, è un bug: annotalo
e segnalalo, non aggirarlo.

**Legenda:** 🔴 blocca il rilascio · 🟡 importante · ⚪ rifinitura

---

## 0. Prima di iniziare

### 0.1 Applica le migration (in questo ordine)

Supabase → SQL Editor → incolla il contenuto → Run. L'ordine conta: alcune
modificano ciò che le precedenti hanno creato.

| # | File | Cosa introduce |
|---|---|---|
| 1 | `20260719_initial_schema.sql` | Tabelle di base, RLS, bucket privati |
| 2 | `20260720_venues_rpc.sql` | Creazione locale via RPC |
| 3 | `20260720_venue_details.sql` | Anagrafica completa del locale |
| 4 | `20260720_storage_hardening.sql` | Limiti su tipo e peso dei file |
| 5 | `20260720_nights.sql` | Serate come entità centrale |
| 6 | `20260720_night_qr_codes.sql` | Più QR per serata, con orari |
| 7 | `20260721_people_and_evs.sql` | Persone nella serata, EV, limite anti-spam |
| 8 | `20260721_venue_messages.sql` | Comunicazioni del locale |
| 9 | `20260721_memories.sql` | Ricordi derivati |
| 10 | `20260721_blocks_reports.sql` | Blocco e segnalazione |

Ognuna deve finire con *"Success. No rows returned"*. Se una fallisce,
**fermati**: le successive daranno errori a cascata.

### 0.2 Configura Supabase per lo sviluppo

- **Authentication → Providers → Email → "Confirm email": OFF**
  Senza questo la registrazione non fa entrare subito e l'invio email è
  limitato a poche all'ora. In produzione va riacceso.
- **Authentication → URL Configuration → Site URL:** `http://localhost:5173`

### 0.3 Prepara due account

Servono da qui in poi. Il modo più veloce:

| Account | Come | Serve per |
|---|---|---|
| **A — locale** | Google o email+password | Creare il locale e le serate |
| **B — utente** | email+password | Entrare col QR |
| **C — utente** | email+password | Verificare che gli estranei non vedano nulla |

⚠️ L'account del **locale deve essere diverso** da quello personale: un
account è personale *o* business, non entrambi (il server lo rifiuta apposta).

Usa una **finestra normale** per uno e una **in incognito** per l'altro, così
restano loggati insieme.

### 0.4 Console per i test da avversario

In sviluppo l'app espone il client Supabase come `window.__supabase`.
Apri la console del browser (F12 → Console) e usa gli snippet dei test 🔒.

```js
// chi sono adesso
(await __supabase.auth.getUser()).data.user?.id

// accedere come utente di test senza passare dalla UI
await __supabase.auth.signInWithPassword({ email: 'b@test.it', password: '...' })
```

---

## 1. Giro completo (~20 minuti)

Il percorso che tocca tutto. Falla prima di tutto il resto: se qui si rompe
qualcosa, i test di dettaglio non servono.

1. **Account A** → `/` → "Sono un locale" → accedi → compila l'onboarding →
   scegli un piano → atterri sulla dashboard
2. Dashboard → **Serate** → crea una serata → **Apri ora**
3. Serata → **QR** → apri il QR principale → copia il codice dall'URL
   (la parte dopo `?t=`)
4. **Account B** (incognito) → registrati → crea il profilo con foto →
   `/scanner` → incolla il codice → **Entra**
5. Dovresti vedere: nome locale, titolo serata, timer che scorre
6. **Ricarica la pagina** → devi essere ancora dentro
7. **Account C** → stessa cosa, entra nella stessa serata
8. B e C ora si vedono nella pagina Persone
9. B manda un **EV** a C → C lo riceve in tempo reale nella pagina EV
10. C ricambia → **match su entrambi**
11. Aprite la **chat** dal match e scrivetevi: i messaggi arrivano senza ricaricare
12. **Account A** → Comunicazioni → pubblica una promo → B e C la vedono
    nella pagina Locale senza ricaricare
13. B → **Ricordi** → la persona e la serata compaiono coi conteggi giusti
14. B → Profilo → **Esci dal locale** → non sei più in sessione

Se arrivi in fondo senza intoppi, l'ossatura dell'app regge.

---

## 2. Test per area

### 2.1 Accesso 🔴

| # | Cosa verifica | Passi | Atteso |
|---|---|---|---|
| A1 | Login Google | `/welcome` → Continua con Google | Entri e vieni smistato |
| A2 | Registrazione email | `/welcome` → Registrati → email + password ≥8 | Entri subito (conferma email OFF) |
| A3 | Password corta | password di 5 caratteri | "La password deve avere almeno 8 caratteri" |
| A4 | Credenziali sbagliate | password errata | "Email o password non corretti" |
| A5 | Email già usata | registrati due volte con la stessa email | "Questa email è già registrata" |
| A6 | **Logout vero** | Profilo → Esci → **ricarica** | Resti fuori, non rientri da solo |
| A7 | Persistenza | login → chiudi il browser → riapri | Sei ancora dentro |

### 2.2 Profilo e foto 🟡

| # | Cosa verifica | Passi | Atteso |
|---|---|---|---|
| P1 | Creazione | primo accesso → crea profilo | Riga in `profiles`, atterri su `/home` |
| P2 | Età minima | inserisci 17 | "Devi avere almeno 18 anni" |
| P3 | Foto | carica una foto | Compare subito e dopo un reload |
| P4 | File non immagine | rinomina un PDF in `.jpg` e caricalo | "Il file non è un'immagine valida" |
| P5 | File enorme | immagine da 40 MB | "Immagine troppo grande (max 15 MB)" |
| P6 | Nessuna foto | profilo senza foto | Avatar grigio di riserva, mai immagine rotta |
| P7 | Modifica | cambia nome/bio/interessi | Persistono dopo reload |

### 2.3 Locale e serate 🔴

| # | Cosa verifica | Passi | Atteso |
|---|---|---|---|
| L1 | Onboarding | registra un locale | Righe in `venues`; `plan` valorizzato |
| L2 | Dati completi | compila città, indirizzo, telefono, orari | Tutti salvati (controlla in Table Editor) |
| L3 | Locale già esistente | rifai `/business-onboarding` | Ti porta alla dashboard, non crea un doppione |
| L4 | Account già personale | prova a registrare un locale con l'account utente | "Questo account è già registrato come utente personale" |
| L5 | Serata in bozza | crea una serata senza aprirla | Badge "Bozza", QR generato ma inattivo |
| L6 | QR inattivo | scansiona il QR di una bozza | "La serata non è aperta" |
| L7 | Apertura | Apri ora | Badge "● In corso", il QR funziona |
| L8 | Orari programmati | crea con apertura tra 2 ore | Badge "Programmata", QR non ancora valido |
| L9 | Più QR | aggiungi "Sala rossa" | Due QR distinti, entrambi validi |
| L10 | Finestra oraria | QR con fine tra 1 minuto → aspetta | Dopo la scadenza: "Questo ingresso non è più valido" |
| L11 | Ultimo QR | prova a eliminare l'unico QR | "Non puoi eliminare l'unico QR della serata" |
| L12 | Rotazione | rigenera un QR | Il vecchio codice smette di funzionare, gli altri no |
| L13 | Chiusura | chiudi la serata | Le sessioni terminano, tutti i QR si spengono |

### 2.4 Check-in 🔴

| # | Cosa verifica | Passi | Atteso |
|---|---|---|---|
| C1 | Ingresso | scansiona il QR di una serata aperta | Entri, vedi locale e serata |
| C2 | Sopravvive al reload | ricarica dopo il check-in | Ancora dentro, timer coerente |
| C3 | Uscita | Profilo → Esci dal locale | Fuori davvero (ricarica per confermare) |
| C4 | QR inesistente | `/checkin?t=11111111-1111-1111-1111-111111111111` | "QR non valido" |
| C5 | Link malformato | `/checkin?t=abc` | "Link non valido", nessuna chiamata al server |
| C6 | Senza account | apri il link del QR da incognito | Ti chiede di accedere **restando sul QR** |
| C7 | Senza profilo | accedi ma non creare il profilo | Ti manda a crearlo e **torna al check-in** |
| C8 | **Cambio sala** | entra dal QR "Sala rossa" mentre sei già dentro | Cambia sala, il tempo **non riparte** |

### 2.5 Persone, EV e match 🔴 *(servono B e C)*

| # | Cosa verifica | Passi | Atteso |
|---|---|---|---|
| E1 | Ci si vede | B e C nella stessa serata | Compaiono a vicenda |
| E2 | Realtime | C entra mentre B guarda la lista | B lo vede comparire **senza ricaricare** |
| E3 | Sale diverse | B da "Ingresso", C da "Sala rossa" | Si vedono, in sezioni separate |
| E4 | Estraneo | account fuori dalla serata | Non vede nessuno |
| E5 | EV | B manda un EV a C | C lo riceve in tempo reale |
| E6 | EV con nota | manda con nota | La nota arriva a C |
| E7 | **Match** | C ricambia | Match su **entrambi**, live |
| E8 | Ignora | C ignora un EV | Sparisce dalla lista di C |
| E9 | Doppio EV | manda due volte alla stessa persona | Nessun duplicato, nessun errore |
| E10 | Limite anti-spam | manda >20 EV in un minuto | "Stai inviando troppi EV" |

### 2.6 Chat 🟡 *(servono B e C)*

| # | Cosa verifica | Passi | Atteso |
|---|---|---|---|
| M1 | Invio | scrivi da B | Arriva a C senza ricaricare |
| M2 | Persistenza | ricarica | La conversazione è ancora lì |
| M3 | Messaggio vuoto | premi invio a vuoto | Non parte nulla |
| M4 | Niente doppioni | manda 5 messaggi di fila | Ognuno compare **una volta sola** |

### 2.7 Comunicazioni del locale 🟡

| # | Cosa verifica | Passi | Atteso |
|---|---|---|---|
| K1 | Pubblicazione | A pubblica una promo | Compare nell'elenco "Pubblicate" |
| K2 | Realtime | B è nella pagina Locale | La vede comparire senza ricaricare |
| K3 | In evidenza | metti in evidenza | Sale in cima anche per B |
| K4 | Solo una serata | messaggio legato a una serata | Non si vede da un'altra serata |
| K5 | Eliminazione | elimina | Sparisce anche per B |
| K6 | Stato vuoto | locale senza comunicazioni | "Nessuna comunicazione", non schermata muta |

### 2.8 Ricordi ⚪

| # | Cosa verifica | Passi | Atteso |
|---|---|---|---|
| R1 | Conosciuti | dopo un match | La persona compare con locale, serata e data |
| R2 | Serate | dopo una serata | Compare coi conteggi EV inviati/ricevuti/match |
| R3 | Conteggi | confronta con quanto fatto davvero | I numeri coincidono |
| R4 | Stato vuoto | account nuovo | Messaggio con invito a entrare in un locale |

### 2.9 Blocco e segnalazione 🔴 *(servono B e C)*

| # | Cosa verifica | Passi | Atteso |
|---|---|---|---|
| B1 | Blocco | B blocca C dalla scheda persona (⋯) | Spariscono a vicenda dalle liste |
| B2 | Anche col match | blocca una persona con cui hai un match | Sparisce anche il match e la chat |
| B3 | Segnalazione | segnala con un motivo | Riga in `reports` **e** blocco automatico |
| B4 | Sblocco | Profilo → Persone bloccate → Sblocca | Tornate a vedervi |
| B5 | Elenco vuoto | nessun blocco | "Nessuna persona bloccata" |

---

## 3. Test da avversario 🔒 🔴

Sono i più importanti: verificano che la sicurezza non stia solo nella UI.
Esegui gli snippet nella **console del browser**.

### 3.1 Da anonimo (finestra in incognito, senza login)

```js
// Nessuno di questi deve restituire dati
await __supabase.from('profiles').select('*')      // → []
await __supabase.from('messages').select('*')      // → []
await __supabase.from('evs').select('*')           // → []
await __supabase.from('matches').select('*')       // → []
await __supabase.from('venue_messages').select('*')// → []

// Nessuna di queste deve funzionare
await __supabase.rpc('check_in', { p_qr_token: '11111111-1111-1111-1111-111111111111' })
await __supabase.rpc('send_ev', { p_receiver: '11111111-1111-1111-1111-111111111111' })
await __supabase.rpc('create_my_venue', { p_name: 'Hack' })
// → permission denied for function ...
```

### 3.2 Da utente autenticato

```js
// 1. Creare un locale intestato a un altro → deve fallire
await __supabase.from('venues').insert({
  owner_id: '00000000-0000-0000-0000-000000000001', name: 'Falso'
})  // → violazione RLS

// 2. Leggere i token QR di locali altrui → deve tornare vuoto o solo i tuoi
await __supabase.from('night_qr_codes').select('*')

// 3. Ruotare il QR di un locale non tuo → deve fallire
await __supabase.rpc('rotate_night_qr', { p_qr: '<id-di-un-altro>' })  // → not_venue_owner

// 4. Scrivere in una chat di cui non fai parte → deve fallire
await __supabase.from('messages').insert({
  match_id: '<match-altrui>', sender_id: (await __supabase.auth.getUser()).data.user.id, text: 'intruso'
})  // → violazione RLS

// 5. Forzare uno stato di pagamento → deve fallire
await __supabase.from('nights').update({ payment_status: 'paid' }).eq('id', '<una-serata>')
```

### 3.3 Privacy delle foto 🔴 *(il test rimandato dal 3b)*

Con l'account C, **non** in sessione né in match con B:

```js
// path della foto di B: <uid-di-B>/avatar.jpg
await __supabase.storage.from('avatars').createSignedUrl('<uid-di-B>/avatar.jpg', 60)
// → deve FALLIRE. Se restituisce un link, è una falla di privacy.
```

Poi ripeti **entrando nella stessa serata**: lì deve funzionare.

### 3.4 Scadenza delle signed URL

```js
const uid = (await __supabase.auth.getUser()).data.user.id;
const { data } = await __supabase.storage.from('avatars').createSignedUrl(uid + '/avatar.jpg', 5);
window.open(data.signedUrl);   // ora: si apre
// aspetta 10 secondi e riapri lo stesso URL → deve dare errore
```

---

## 4. Robustezza 🟡

| # | Cosa verifica | Come | Atteso |
|---|---|---|---|
| T1 | Rete lenta | DevTools → Network → Slow 3G → carica una foto | Spinner visibile, mai schermata muta |
| T2 | Rete assente | Network → Offline → manda un EV | Messaggio d'errore chiaro, niente falsi successi |
| T3 | Messaggio non inviato | offline → scrivi in chat | Il testo **resta nel campo** |
| T4 | Sessione scaduta | aspetta la scadenza con l'app aperta | Esci da solo, senza crash |
| T5 | Doppio tap | premi "Invia EV" due volte veloce | Un solo EV |
| T6 | Schermo piccolo | DevTools → iPhone SE | Niente testo tagliato o scroll orizzontale |

---

## 5. Cosa NON è testabile adesso

Elencato per non cercare invano funzioni che non esistono ancora.

| Area | Stato |
|---|---|
| **Pagamenti (Stripe)** | Non esiste nulla. Piani e drink non incassano; `open_night` non controlla il pagamento apposta, altrimenti nulla sarebbe testabile |
| **Drink** | Disattivato di proposito, con badge "Presto" |
| **Recupero password** | Non implementato: chi perde la password resta fuori |
| **Scanner con fotocamera** | Si incolla il codice, oppure si inquadra il QR con la fotocamera di sistema |
| **Locali vicini** | `venues.location` è sempre vuoto: la ricerca per vicinanza non restituisce nulla |
| **Notifiche push** | Step 5, insieme alle app native |
| **Insight della dashboard** | Dati dimostrativi, dichiarati come tali nella pagina |
| **Cancellazione account** | Non implementata |
| **Coda di moderazione** | Le segnalazioni si leggono dal dashboard Supabase |

---

## 6. Come segnalare un problema

Serve poco, ma preciso:

1. **Cosa facevi** (il numero del test, se c'è)
2. **Cosa ti aspettavi**
3. **Cosa è successo**
4. **Console** (F12 → Console): copia eventuali righe rosse
5. **Chi eri**: account A, B o C; finestra normale o incognito

> Il buffer della console conserva messaggi vecchi: per un segnale pulito
> apri una **scheda nuova**, riproduci il problema e guarda lì.
