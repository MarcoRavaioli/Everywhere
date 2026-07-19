# EveryWhere — Roadmap tecnica

Checklist viva del percorso da demo Base44 a app in produzione.
Aggiornata a ogni step completato.

**Stack deciso:** Supabase (EU) · Cloudflare Pages · Capacitor · FCM · Sentry · Stripe (per ultimo)

**Regola di prodotto centrale:** un profilo è visibile solo a chi ha una sessione
attiva nello stesso locale o a un match. Nessun browsing esterno degli utenti.

---

## ✅ Step 1 — Fondamenta (completato)

- [x] `git init` su `main`, primo commit dello stato demo
- [x] Fix import rotti in `App.jsx` (`Locale` → `Local`, case di `BusinessOnBoarding`) — build di produzione verificata
- [x] Analisi auth Base44: piano di sostituzione approvato (interfaccia `useAuth()` invariata, solo Google in dev, Apple rimandato all'account Developer)
- [x] Schema dati + RLS approvati (v. sotto)
- [ ] Push su GitHub (quando il repo remoto esiste)

## 🔨 Step 2 — Backend Supabase (in corso)

- [x] Setup a carico di Marco: progetto Supabase dev (regione EU) + Google OAuth su Google Cloud Console
- [x] `.env.local` con `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- [x] Client Supabase (`src/lib/supabaseClient.js`)
- [x] Riscrittura `AuthContext` su Supabase Auth (Google), stessa interfaccia `useAuth()`
- [x] Rimozione dipendenze Base44 (`@base44/sdk`, `@base44/vite-plugin`, `base44Client.js`, `app-params.js`)
- [x] Migration SQL: tabelle `profiles`, `venues`, `sessions`, `evs`, `matches`, `messages`, `venue_messages`, `memories`, `drinks` (+ PostGIS) — applicata sul progetto dev
- [x] RLS su tutte le tabelle (visibilità profili: stesso-locale-attivo + match) — verificata: anon riceve zero righe
- [x] RPC: check-in via `qr_token`, invio EV con validazione sessione — execute negato ad anon
- [x] Match su EV reciproco (dentro la RPC `send_ev`)
- [x] Bucket Storage privati `avatars` e `memories` (signed URL)
- [ ] Nota: un business può avere più `venues` a livello dati; l'onboarding/UI per ora assume 1 locale

## 📡 Step 3 — Collegare il frontend + Realtime

- [ ] Sostituire i mock di `AppContext` con query Supabase (persone in sessione, EV, match, memories, messaggi del locale)
- [ ] Realtime su `messages`, `evs`, `matches` (chat e notifiche live)
- [ ] Flusso reale: Scanner QR → check-in → sessione → EV → match → chat
- [ ] Upload foto profilo su Storage
- [ ] Attivare `ProtectedRoute` sulle route di sessione
- [ ] Onboarding business → crea `venue` reale con QR

## 🚀 Step 4 — Deploy: Cloudflare Pages + Sentry

- [ ] Repo GitHub + deploy automatico Cloudflare Pages (prod da `main`, preview dai branch)
- [ ] Secondo progetto Supabase (prod) + env separate
- [ ] Sentry (errori frontend) + uptime monitor
- [ ] Dominio (Cloudflare Registrar) — quando scelto il nome

## 📱 Step 5 — Capacitor + push

- [ ] Wrapping Capacitor (iOS + Android)
- [ ] Firebase Cloud Messaging: push per EV ricevuto / match / messaggio
- [ ] Apple Developer account → Sign in with Apple + build App Store
- [ ] Geolocalizzazione nativa (permessi, prossimità locali)

## 💳 Step 6 — Stripe (per ultimo)

- [ ] Flusso drink reale: PaymentIntent lato server (Edge Function), webhook → stato `paid`
- [ ] Riconciliazione stati `drinks` solo server-side (mai dal client)
- [ ] Eventuale lato abbonamenti business
