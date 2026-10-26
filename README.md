# Tuklas AR Science Lab

Full-stack browser-delivered WebAR PWA for Grade 9 Predict-Observe-Explain science activities.

Experiments start in **3D Model Mode** whenever the app opens or a user signs in, including on browsers that previously saved a camera preference. No camera or marker is required. **Use Camera** switches to marker-based AR during the session; **Use 3D Model** switches back. Teachers can use **Home → Preview Lessons** without creating a class, and preview answers are not saved as student work.

## Tech Stack

- Frontend: React, TypeScript, Vite, Three.js, AR.js
- Offline storage: IndexedDB with localStorage fallback metadata
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL through Prisma ORM

## Project Structure

```text
.
├── backend
│   ├── prisma
│   │   └── schema.prisma
│   └── src
│       ├── data
│       ├── lib
│       ├── routes
│       ├── app.ts
│       └── server.ts
├── frontend
│   ├── public
│   │   ├── assets
│   │   ├── manifest.webmanifest
│   │   └── service-worker.js
│   └── src
│       ├── components
│       ├── data
│       ├── lib
│       ├── types
│       ├── App.tsx
│       └── main.tsx
├── .env.example
└── package.json
```

## Getting Started

Install dependencies:

```bash
npm install
```

Create environment files from `.env.example`.

For the backend, set `DATABASE_URL` to your PostgreSQL connection string:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tuklas_ar?schema=public"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
```

For the frontend, set:

```bash
VITE_API_URL="http://localhost:4000/api"
```

Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

Start the API:

```bash
npm run dev:backend
```

Start the frontend in another terminal:

```bash
npm run dev:frontend
```

Open `http://localhost:5173`.

## Current Features

- Student and teacher/demo entry modes
- Twelve-experiment POE activity library
- Marker-based AR observation with local AR.js tracking and calibration files
- Three.js-powered interactive 3D fallback scene
- Local saved activity records through IndexedDB
- Offline preparation through a service worker
- JSON export of student work
- Backend `/api/modules`, `/api/sync`, and `/api/health` routes
- PostgreSQL schema for modules and activity records

## Offline Sync Model

Student work is saved locally first. When the device is online, the Settings screen can sync unsynced IndexedDB records to the Express API, which persists them in PostgreSQL.

Describe the app as offline-capable after initial download and setup. Browser storage may still be cleared or evicted by the device.

The production build precaches the app, all twelve experiments, the lazy-loaded Three.js and AR.js code, and the marker/calibration files. Settings reports readiness only after the service worker confirms these files are cached. Offline preparation is unavailable on the Vite development server; use a production build over HTTPS or localhost.

Sign in while online before going offline. An existing session can open lessons, run 3D/AR trials, save POE work locally, and export JSON without a connection. Login, account/class management, server progress/feedback, and uploading saved work require connectivity. Offline AR still requires camera permission and a device/browser that supports WebGL and camera access.

## Deployment

Frontend: **Vercel**. Backend: **Vercel** (separate project, serverless functions). Database: **Neon** (Postgres).

1. Create a Neon project and copy its pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) connection strings — `schema.prisma` uses both: `url` (pooled, runtime queries) and `directUrl` (unpooled, required for migrations since pgbouncer connections can't run Prisma's schema diffing).
2. Locally, set both in `backend/.env` and run:

   ```bash
   npm run db:migrate --workspace backend -- --name init
   ```

   This creates `backend/prisma/migrations/` and applies the schema to Neon. Commit the generated migration files — production only ever *applies* migrations (`prisma migrate deploy`), it never generates them.
3. On Vercel, create a **second** project from this repo (separate from the frontend one) with **Root Directory set to `backend`**. It picks up [backend/vercel.json](backend/vercel.json) (rewrites every path to the [backend/api/index.ts](backend/api/index.ts) serverless entry, which wraps the same Express `app` used locally) and [backend/package.json](backend/package.json)'s `vercel-build` script (`prisma generate && prisma migrate deploy`). Set project env vars:
   - `DATABASE_URL` and `DIRECT_URL` — the Neon connection strings.
   - `CLIENT_ORIGIN` — comma-separated list of allowed origins, e.g. `https://your-app.vercel.app,https://your-app-git-preview.vercel.app` (see note below — no wildcard matching).
4. On the frontend Vercel project, set `VITE_API_URL` to `https://<your-backend-project>.vercel.app/api`.
5. After the first deploy, seed the module library once: `POST https://<your-backend-project>.vercel.app/api/modules/seed`.

Notes:
- `schema.prisma`'s `generator client` sets `binaryTargets = ["native", "rhel-openssl-3.0.x"]` so the Prisma query engine works both on your local machine and on Vercel's Linux runtime.
- The backend's CORS check does exact string matches against `CLIENT_ORIGIN`, not glob/wildcard matching — list Vercel preview URLs explicitly if you need them, or extend `app.ts`'s origin check if preview URLs are unpredictable.
- `backend/src/server.ts` (the local `npm run dev` entry with `app.listen`) is unused in the Vercel deployment — Vercel calls the exported Express `app` from `backend/api/index.ts` directly per-request.

## Recommended Testing

```bash
npm run typecheck
npm run build
npm run test:experiments
npm run test:sync
```

The sync regression checks record ownership and batch rollback with a mocked database, concurrent fallback saves, delayed uploads, reconciliation, account changes, and session expiration. The browser regression additionally checks real IndexedDB concurrency, resets while an activity is open, and session changes without losing saved work.

With a dedicated Chrome test profile running on remote debugging port 9222, run the offline browser regression in PowerShell:

```powershell
$env:TEST_OFFLINE = '1'
npm run test:browser
```

This serves `frontend/dist` on loopback port 5186, prepares a fresh offline cache before any lesson is opened, stops that server, disables the HTTP cache, and reloads the app. It exercises all twelve 3D scenes and real AR.js detection using a synthetic camera stream, marker loss/reacquisition, local POE persistence, JSON export, queued uploads to a mock API, and failed preparation when a required file is missing. The test simulates browser online/offline status; the app server remains stopped throughout the offline checks. Screenshots are saved in `.browser-check/screens`. Physical camera behavior, Android/iOS home-screen installs, and real backend sync still need device/integration testing.

Before expanding all modules, test the Newton's-law activity on the weakest available Android phone and one iPhone Safari/home-screen install.
