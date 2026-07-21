# EveryWhere

App social basata sui locali: le persone presenti nello stesso locale possono
vedersi, mandarsi un "EV" (interesse), matchare, chattare e offrirsi un drink.
Include un lato business per i locali (dashboard, messaggi/promo, QR di check-in).

**Stack:** React + Vite + Tailwind + shadcn/ui · Supabase (Postgres, Auth, Realtime, Storage) · Cloudflare Pages

Stato del progetto, cose in sospeso e prossimi passi: [ROADMAP.md](ROADMAP.md).
Come provare che tutto funzioni davvero: [TESTING.md](TESTING.md).

> Il codice è più avanti dei test: quasi nulla è stato ancora validato su
> dati veri. Prima di aggiungere funzioni, conviene eseguire la guida.

## Sviluppo locale

Prerequisiti: Node 20+.

1. Installa le dipendenze:

   ```sh
   npm install
   ```

2. Crea `.env.local` nella root con le chiavi del progetto Supabase di dev
   (Dashboard → Project Settings → API):

   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<publishable/anon key>
   ```

   La anon key è pubblica per design: la sicurezza dei dati è garantita dalle
   Row Level Security policy sul database. Non mettere mai qui la
   `service_role` key.

3. Avvia il dev server:

   ```sh
   npm run dev
   ```

## Script

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Dev server con hot reload |
| `npm run build` | Build di produzione in `dist/` |
| `npm run preview` | Serve la build di produzione in locale |
| `npm run lint` | ESLint |

## Auth

Login con Google via Supabase Auth (flusso OAuth con redirect).
Apple verrà aggiunto con l'account Apple Developer (necessario comunque per
la pubblicazione su App Store).
