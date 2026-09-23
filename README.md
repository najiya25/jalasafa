# JalSafa — Public Sanitation & Drinking-Water Point Finder

**Track PS-08 · Public Welfare and Access** — one-city map app to find public
toilets & drinking-water points, check condition / accessibility / freshness,
and report problems end-to-end.

**App name:** JalSafa · *Find public toilets & drinking water near you*
**Demo city:** Kochi, Kerala (**sample dataset — organiser files not yet supplied**)

---

## 1. What changed in this repository

The repo previously contained only `medifind_updated/` — a static HTML/CSS/JS
prototype for a *different* (medicine) problem statement, with no build system,
no backend and no TypeScript. That folder was **left untouched**.

This project adds a complete, working application at the repository root:

- New Vite + React 18 + **TypeScript** frontend
- New **Express + SQLite** (libsql) backend with a real API and schema
- Seeded one-city dataset, local-body mapping and workflow rules
- Service-worker + localStorage offline support
- Admin/demo ticket desk with simulated local-body routing
- Prototype **account** (guest · sign up · sign in) — salted scrypt + HMAC token
- **Language switcher** (English · മലയാളം · हिन्दी · தமிழ்) from one central dictionary
- **Facilities Along My Route** — clearly-labelled simulated corridor search

## 2. Architecture

```
Browser (React + TS)                     Server (Express + TS, port 8787)
┌──────────────────────────┐             ┌──────────────────────────────────┐
│ HomePage  map · filters  │  /api/*     │ index.ts   routes + static dist  │
│ FacilityPage  details    │────────────▶│ store.ts   all SQL (the store)   │
│ ReportPage   no identity │  fetch      │ db.ts      schema + first seed   │
│ TicketPage   confirmation│             │ seed-data.ts  ONE-CITY sample    │
│ AdminPage    ticket desk │             └───────────────┬──────────────────┘
│ lib/ api · cache · geo   │                             │ libsql (file: jalsafa.db)
│ public/sw.js  offline    │                             ▼
└──────────────────────────┘                        server/data/jalsafa.db
```

Key decisions (each explainable by two students):

- **`shared/types.ts`** — one type file imported by *both* sides, so every API
  response is type-checked end to end.
- **`server/store.ts`** — the *only* place SQL is written. Routes stay tiny.
- **Privacy by schema** — the `tickets` table has **no** name / phone / email /
  location column. Identity cannot leak because it is never stored.
- **Location** lives in React state only (`lib/hooks.ts`): never persisted,
  never sent to the server.
- **Offline** — `public/sw.js` caches shell + `/api/*` + OSM tiles;
  `src/lib/cache.ts` mirrors the facility list, facility details and
  recently-viewed ids into localStorage as a second layer.
- **libsql** chosen over better-sqlite3 because it ships prebuilt N-API
  binaries (no C++ toolchain needed on any machine).
- **Prototype auth** — `server/auth.ts` hashes with salted scrypt and signs a
  stateless HMAC token; `users` is a table *separate* from `tickets`, so a
  signed-in identity can never attach itself to a report. The finder never
  requires login (guest works fully).
- **One translation object** — `src/lib/i18n.tsx` holds every UI label in four
  languages (type-checked for full coverage); the choice is stored in
  localStorage and applied instantly, without reload or data reset.
- **Route = straight line** — `distanceToSegmentKm()` measures each facility's
  distance to the start→destination segment (free, offline, no API key), and
  the UI says plainly that it is SIMULATED, not turn-by-turn navigation.

## 3. Run locally

```bash
npm install
npm run dev          # API :8787 (tsx watch) + UI :5173 (Vite, proxies /api)
```

Open http://localhost:5173

Production build + single-process serve:

```bash
npm run build        # tsc typecheck is separate: npm run typecheck
npm start            # Express serves dist/ + API on :8787
```

Open http://localhost:8787

Other scripts:

| Command | Purpose |
|---|---|
| `npm run typecheck` | Strict TS check for client **and** server |
| `npm run seed` | Local: drop + re-seed the demo DB. With `TURSO_*` env vars: seed Turso once (only if empty) |
| `npm run build` | Build the frontend to `dist/` |
| `npm run qa` | Automated 19-area QA suite (headless Chromium, ~2 min) |
| `npm run filter-test` | Proves every facility filter (type/distance/availability/condition/accessibility, offline too) |

Environment: Node 18+ (tested on 21.7.3). No other system dependencies.

## 4. Testing the complete judging flow (2–3 min)

1. Open the app → map of Kochi loads with 29 facility markers.
2. **Nearby**: click *Use my location* → list re-sorts nearest-first; red dot =
   your position (permission-gated, never stored).
3. **Filter**: click *🚻 Toilets* then *♿ Accessible facility only* → only
   fully accessible toilets remain (map refits).
4. **Details**: open *Vyttila Mobility Hub Accessible Toilet* → condition,
   availability, hours, accessibility table, responsible local body, and
   **"Last updated: 23 Sep 2026, 6:20 AM"** are all visible.
5. **Offline**: DevTools → Network → Offline (or turn off Wi-Fi) → header shows
   **Offline mode**, cards/details still load from cache; the Report button
   explains it needs a connection.
6. Reconnect → **Report a problem** → choose *🚱 No water* (or *⚠️ Broken*) →
   optional description → submit.
7. **Confirmation**: ticket ID (`JS-YYYYMMDD-XXXX`), status **Submitted**,
   5-step journey with **responsible local body**, priority + response target.
8. Open **Ticket desk** (`/admin`) → the same ticket appears under that local
   body (stats + filters) → click **Assign ticket → Start work → Mark
   resolved** to show the full status journey.
9. **Language**: pick *🌐 മലയാളം* (or हिन्दी / தமிழ்) in the navbar → every UI
   label switches instantly, survives reload and never resets loaded data.
10. **Along My Route**: open *Along My Route* → Kochi → Aluva → facilities
    within 1 km of the clearly-labelled SIMULATED corridor, each card showing
    its distance *from the route*; narrow with *Available only* or the width
    select.
11. **Account** (optional): the first visit offers *Continue as Guest ·
    Sign in · Create account*; create an account → the navbar shows your
    name; sign out returns to guest browsing. Login never gates the finder.

API-level checks (also used in QA):

```bash
curl http://localhost:8787/api/health
curl http://localhost:8787/api/facilities | head -c 400
curl -X POST http://localhost:8787/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"facilityId":"f07","issue":"no_water","description":"tap dry"}'
curl -X PATCH http://localhost:8787/api/tickets/<id>/advance
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo-password-1"}'   # 401 until signed up
```

## 5. Limitations

- **Sample data**: 29 Kochi facilities, 5 local bodies and the priority/SLA
  rules are seeded samples (clearly labelled in UI + README) because no
  organiser dataset exists in the repository yet.
- Route search is a **straight line** between two named demo places — labelled
  SIMULATED in the UI. No turn-by-turn navigation, no routing service, no paid
  API key. The demo admin desk still has no auth (by design — labelled
  SIMULATED); the prototype account system is separate from it.
- Map tiles come from OpenStreetMap; tiles already viewed are cached, but a
  never-visited area shows blank tiles offline (the list still works).
- Location permission denied → distance filter/sort stays disabled (by design,
  with an explanation).
- **Prototype account only**: salted scrypt + HMAC token (30-day TTL) with a
  dev fallback secret — set `JALSAFA_AUTH_SECRET` in production. No email
  verification, no password reset, no social login; structured to be replaced.
- **Language**: four languages from one central dictionary. Long prose (footer,
  server-sent stepper wording, map popups) and two rare admin error strings
  remain English; the translations are demo-quality, not professional.
- Automated QA: `npm run qa` boots a production server, drives a real headless
  Chromium through the whole judging flow (including a live offline test) and
  asserts all 19 areas (16 mandatory + account · language · route) — 152
  checks, all green as of the last run.

## 6. Organiser resources still needed

1. Facility dataset (one city) with condition/accessibility/status fields
   → replace `server/seed-data.ts` `FACILITIES` (same shape).
2. Accessibility field list actually used by the dataset → adjust
   `Accessibility` in `shared/types.ts`.
3. Official local-body mapping → replace `LOCAL_BODIES`.
4. Ticket workflow rules (priority / response times) → replace `WORKFLOW_RULES`.
5. Cached map data (if the organiser provides a tile/vector package) →
   register it in `public/sw.js`.
6. User scenarios & status categories for final wording alignment.

## 7. Build / deploy commands

```bash
npm ci                 # install (Node 18+)
npm run typecheck      # optional: strict TS, client + server
npm run build          # build frontend → dist/
npm run qa             # optional: 19-area end-to-end QA (needs Playwright chromium)
npm start              # serve UI + API (PORT env, default 8787)
```

Anywhere a Node process runs (Render / Railway / Fly / a VM): set `PORT`,
run the commands above.

### Deploying to Vercel (Turso hosted libSQL)

The UI is static (`dist/`, served by Vercel's CDN) and the API is one
serverless function (`api/index.ts`, routed by `vercel.json` rewrites) —
Vercel never runs `npm start`.

1. **Create the database + seed it ONCE** (same SQLite engine, hosted):

   ```bash
   turso db create jalsafa-ps08
   turso db show jalsafa-ps08 --url        # → TURSO_DATABASE_URL
   turso db tokens create jalsafa-ps08     # → TURSO_AUTH_TOKEN

   # bash:
   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run seed
   # PowerShell:
   $env:TURSO_DATABASE_URL="libsql://…"; $env:TURSO_AUTH_TOKEN="…"; npm run seed
   ```

   Seeding is idempotent — it only inserts when the tables are empty, so it
   never wipes existing tickets.
2. **Vercel**: import the GitHub repo (auto-detects Vite → build
   `npm run build`, output `dist`) → add the two env vars above
   (Production + Preview) → Deploy.
3. **Verify**: `/api/health` → `{ ok: true, facilityCount: 29 }`, file a
   report → it appears on the Ticket desk, advance a ticket, reload
   `/facility/f07`, toggle offline mode.

Neither variable is needed locally — development always uses the embedded
`server/data/jalsafa.db` file.
