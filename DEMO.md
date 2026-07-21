# EveryWhere — Scaletta demo dal vivo

Provare l'app in casa con più telefoni sulla stessa rete WiFi.

**Indirizzo della demo:** `http://192.168.0.117:5173`
(se cambia rete, ricontrolla con `ipconfig getifaddr en0`)

> ⚠️ **Usa sempre l'indirizzo di rete, mai `localhost`.** Un QR generato da
> `localhost` contiene "localhost": sul telefono di un altro punta a quel
> telefono, non al tuo computer. La dashboard ora te lo segnala in rosso,
> ma è l'errore più facile da fare.

---

## Prima che arrivino (20 minuti)

### 1. Applica le migration — 8 minuti 🔴

Senza queste **non funziona niente**. Supabase → SQL Editor → una alla volta,
in ordine (vedi [TESTING.md](TESTING.md) §0.1 per l'elenco completo):

```
20260719_initial_schema     20260720_night_qr_codes
20260720_venues_rpc         20260721_people_and_evs
20260720_venue_details      20260721_venue_messages
20260720_storage_hardening  20260721_memories
20260720_nights             20260721_blocks_reports
```

Ognuna deve dire *"Success"*. Se una fallisce, fermati: le successive
falliscono a cascata.

### 2. Configura Supabase per la rete locale — 3 minuti 🔴

**Authentication → URL Configuration**
- Site URL: `http://192.168.0.117:5173`
- Redirect URLs: aggiungi **sia** `http://192.168.0.117:5173/**` **sia**
  `http://localhost:5173/**`

Senza questo **il login Google fallisce dai telefoni**: Supabase rifiuta di
rimandare l'utente a un indirizzo non autorizzato.

**Authentication → Providers → Email**
- "Confirm email": **OFF** — così chi si registra con email entra subito.
  Serve come piano B se Google desse problemi.

### 3. Avvia il server

```sh
npm run dev
```

Vite ora ascolta anche sulla rete: nell'output vedrai una riga **Network**
con l'indirizzo da usare. Aprilo **tu per primo** su `http://192.168.0.117:5173`.

### 4. Prepara locale e serata — 5 minuti

1. `/` → **Sono un locale** → accedi (usa un account Google **diverso** dal
   tuo personale: un account è personale *o* business, non entrambi)
2. Compila l'onboarding → scegli un piano (non addebita nulla)
3. Dashboard → **Serate** → crea *"Demo cofondatori"* → **Apri ora**
4. Dentro la serata → **Aggiungi un QR** per ogni stanza:
   - "Ingresso" (senza orari → attivo subito)
   - "Cucina" (senza orari → attivo)
   - "Terrazza" → metti **"Attivo da"** tra due ore → resterà **inattivo**
5. Per ognuno: apri il QR → **Stampa** (stampa solo il codice) oppure
   tieni aperta la pagina su un tablet/secondo schermo

> Verifica prima di stampare: sotto il QR c'è l'URL. Deve iniziare con
> `http://192.168.0.117:5173`. Se dice `localhost`, hai aperto la dashboard
> dall'indirizzo sbagliato.

### 5. Prova tu il giro completo — 4 minuti

Da telefono, inquadra il QR "Ingresso" con la **fotocamera di sistema**:
si apre il browser sul check-in. Registrati, crea il profilo, entra.
Se questo funziona, funzionerà anche per loro.

---

## Quando arrivano

### Cosa dire mentre si collegano

> "Connettetevi al WiFi, poi inquadrate uno dei QR in giro per casa con la
> fotocamera del telefono. Ogni QR è una zona diversa dello stesso locale."

### Il percorso da far fare

1. **Inquadrano un QR** → si apre l'app sul check-in
2. **Accedono** con Google (o email+password) — restano sulla pagina del QR
3. **Creano il profilo**: nome, età, foto, interessi
4. **Entrano** → vedono nome del locale e serata
5. **Si vedono tra loro** nella pagina Persone
6. **Mandano un EV**, anche con una nota
7. Quando è **reciproco → match**, live su entrambi i telefoni
8. **Chattano** dal match

### I momenti che fanno effetto

- **Il QR inattivo**: fai inquadrare la "Terrazza" → messaggio chiaro invece
  di un errore criptico. Mostra che gli orari sono reali.
- **Il tempo reale**: mentre uno guarda la lista, un altro entra → compare da
  solo, senza ricaricare. Stessa cosa col match.
- **Le sale**: chi entra da QR diversi si vede lo stesso ("è la stessa festa")
  ma sa chi ha vicino — la lista è divisa in "Nella tua sala" e "Altrove".
- **Cambio stanza**: chi ha già fatto check-in inquadra un altro QR → cambia
  sala e **il tempo non riparte**.
- **La comunicazione del locale**: dal tuo portatile pubblichi una promo →
  compare sui loro telefoni senza che tocchino nulla.
- **Chiusura serata**: chiudi dalla dashboard → escono tutti insieme e i QR
  si spengono. Buona chiusura della demo.

---

## Cosa NON mostrare (non c'è)

| Cosa | Cosa dire se lo chiedono |
|---|---|
| **Offrire un drink** | Disattivato di proposito, con badge "Presto": arriva con i pagamenti. Prima c'era un finto pagamento che chiedeva la carta senza incassare, l'ho tolto |
| **Pagamenti** | Nessun incasso: i piani sono salvati ma non fatturano. È lo Step 6 |
| **Notifiche push** | Arrivano con le app native (Capacitor) |
| **Recupero password** | Non c'è: se qualcuno sbaglia password, registralo con un'altra email |
| **Scanner interno** | Si usa la fotocamera del telefono, che apre l'app da sola. Lo scanner in-app arriva dopo |
| **App negli store** | Per ora gira nel browser; il codice è già pronto per essere impacchettato |
| **Insight della dashboard** | I numeri sono dimostrativi e la pagina lo dichiara |

---

## Se qualcosa va storto

| Problema | Causa quasi certa | Rimedio |
|---|---|---|
| Il telefono non apre la pagina | Non è sulla stessa WiFi, o hai dato `localhost` | Fai aprire `http://192.168.0.117:5173` a mano |
| Il QR apre una pagina bianca / "impossibile connettersi" | QR generato da `localhost` | Riapri la dashboard dall'IP e rigenera |
| Google login gira a vuoto | Redirect URL non autorizzato su Supabase | Aggiungi `http://192.168.0.117:5173/**` |
| "La serata non è aperta" | Serata in bozza o QR fuori orario | Dashboard → Serate → Apri ora |
| Non si vedono tra loro | Sono in serate diverse, o uno è uscito | Controlla "Presenti ora" in dashboard |
| Registrazione email bloccata | "Confirm email" ancora attivo | Spegnilo, oppure usa Google |
| Schermata "Qualcosa è andato storto" | Errore imprevisto | "Ricarica l'app"; poi mandami la console |

**Piano B se la rete fa i capricci:** fai tutto dal tuo portatile mostrando
due finestre affiancate (una normale, una in incognito). Il flusso è
identico, cambia solo che i telefoni non partecipano.

---

## Dopo la demo

Segna cosa si è rotto e cosa ha colpito: sono i due elenchi più preziosi che
avrai. Poi si riprende da [TESTING.md](TESTING.md), che è la cosa che manca
davvero prima di far entrare utenti veri.
