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

### 3b — Foto profilo (Storage)
- [ ] Upload dal form profilo (bucket `avatars`, path `<uid>/…`, resize client-side)
- [ ] Signed URL con cache in memoria; fallback avatar se assente
- [ ] **Test:** carico una foto → la vedo su Profile e dopo un reload; il file
      compare in Storage sotto il mio uid; un altro utente non in sessione
      con me NON può ottenerne la signed URL

### 3c — Lato business: locale reale + QR
- [ ] BusinessOnBoarding: crea `profiles(account_type=business)` + `venues` + riga `venue_qr_tokens`
- [ ] BusinessDashboard: mostra il QR del locale (libreria `qrcode.react`), presenze attive, CRUD `venue_messages`
- [ ] Rotazione QR token dall'owner
- [ ] **Test:** onboarding completo → righe in `venues`+`venue_qr_tokens`; il QR
      si vede in dashboard; un utente normale non vede il token via API

### 3d — Check-in e sessione reale
- [ ] Formato QR: URL `https://<app>/checkin?t=<token>` (funziona anche da fotocamera nativa, pronto per deep link Capacitor)
- [ ] Scanner con camera reale (`html5-qrcode` o simile) + fallback inserimento manuale
- [ ] SessionConfirm mostra il locale vero; conferma → RPC `check_in`
- [ ] Sessione in AppContext letta dal DB (`expires_at` reale, sopravvive al reload); `endSession` → RPC
- [ ] **Test:** scansiono il QR del mio locale di prova → sessione attiva col
      timer giusto → reload: ancora attiva → esco: chiusa; QR invalido → errore chiaro

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
