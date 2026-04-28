# Futbool web

Next.js 15 + Tailwind v4 + TypeScript + shadcn-style primitives. Dark-first,
Claude-esque palette.

## Run

```bash
cd web
cp .env.local.example .env.local   # fill with your own values
npm install
npm run dev                         # http://localhost:3000
```

### Windows local dev (PowerShell)

Repo root'tan `scripts/setup-env.ps1` çalıştırarak hem `.env` hem
`web/.env.local` doldurulur. Ardından:

```powershell
cd $HOME\Documents\Futbool-test\web
npm install
npm run dev
```

Terminal'i **kapatma** — `next dev` foreground process'tir, pencere
kapanırsa server ölür ve tarayıcı `ERR_CONNECTION_REFUSED` görür.
`✓ Ready in N ms` satırını gördükten sonra tarayıcıda
`http://localhost:3000` aç.

Backend ayrı bir PowerShell penceresinde çalışmalı:

```powershell
cd $HOME\Documents\Futbool-test
.\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload --port 8000
```

## Pages

- `/`           landing
- `/login`      sign in (Supabase Auth)
- `/signup`     create account (Supabase Auth)
- `/chat`       **main feature** — agent selector, tool-call inspector, structured output
- `/pricing`    packages + token economy
- `/account`    profile + subscription overview
- `/admin`      placeholder (Phase 3)

## Architecture notes

- Auth lives in Supabase; the browser SDK mints a JWT and we attach it to every
  request hitting the FastAPI backend (`lib/api.ts`).
- `lib/api.ts` centralises backend calls — single source for `/v1/chat`,
  `/v1/agents`, etc.
- `components/john-answer.tsx` parses John's six-section output format
  (Direct view / Market read / Why / My angle / Surprise / Confidence) and
  renders each block with its own typography. A `ConfidenceMeter` visualises
  the 1-10 score.
- `components/tool-call.tsx` shows every tool call the model made, collapsed by
  default. Colour-coded when a tool returned `data_missing: true` — this makes
  the anti-hallucination guarantee visible to the user.
- Theme: CSS-first Tailwind v4. Tokens in `app/globals.css` under `@theme`
  (OKLCH colour space). Accent currently John's blue — later agents will carry
  their own accent via a small `ThemeProvider`.
- No server components from Supabase yet — all auth is client-side for
  simplicity. SSR + middleware-based protection can be added when needed.

## Phase plan

- **Phase 3 (current)**: UI shell, chat demo against backend mock providers.
- **Phase 3.5**: admin panel fully wired, subscription management pages.
- **Phase 4**: streaming responses (SSE), per-agent theming, mobile polish.
- **Phase 5**: wrap with React Native or Capacitor for APK / iOS.
