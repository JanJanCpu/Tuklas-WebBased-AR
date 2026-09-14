# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tuklas AR Science Lab — an offline-first WebAR PWA for Grade 9 Predict-Observe-Explain (POE) science activities, with marker-based AR (AR.js) and a Three.js 3D fallback. npm workspaces monorepo: `frontend` (React 19 + Vite + TypeScript) and `backend` (Express + TypeScript + Prisma/PostgreSQL).

## Commands

Run from the repo root unless noted.

```bash
npm install                          # installs both workspaces
npm run dev:frontend                 # Vite dev server on :5173
npm run dev:backend                  # tsx watch on :4000
npm run typecheck                    # both workspaces (tsc --noEmit / tsc -b --noEmit)
npm run build                        # both workspaces
```

Database (from `backend/`, needs `DATABASE_URL`/`DIRECT_URL` in `backend/.env`):
```bash
npx prisma migrate dev --name <name>   # create + apply a migration locally
npx prisma migrate deploy              # apply pending migrations (used in production builds)
npx prisma studio                      # browse the DB
npx prisma db execute --schema prisma/schema.prisma --stdin <<< 'SQL;'   # one-off SQL
```

There is no test suite in this repo. There is no lint script — verification is `npm run typecheck` plus `npm run build`.

**Windows dev gotcha**: `npm run dev:backend` runs `tsx watch`, which on Windows can leave an orphaned `node.exe` bound to port 4000 that survives stopping the task through the harness. If `prisma generate`/`migrate` fails with `EPERM: ... query_engine-windows.dll.node` or a fresh `dev:backend` fails with `EADDRINUSE`, find and kill the stray process: `netstat -ano | grep ":4000"` then `taskkill //PID <pid> //F`.

## Deployment topology

Three independently deployed pieces, each its own project/service:
- **Frontend**: Vercel project owned by a teammate (not this session's account) — a static Vite build.
- **Backend**: a *separate* Vercel project (`tuklas-backend`, team `tuklasar`), deployed as serverless functions, live at `https://tuklas-backend-two.vercel.app`. The Express app is NOT deployed as-is: `backend/api/index.js` (plain JS, not TS — see below) imports the `tsc`-compiled `dist/app.js` and exports it as the Vercel function; `backend/vercel.json` sets `framework: null` (Vercel's Express auto-detection otherwise tries to build `src/app.ts` directly and fails on a `helmet` import-interop error) plus a catch-all rewrite to that function. `backend/public/index.html` is a placeholder required only because Vercel's static-output check wants an `outputDirectory` to exist. The `vercel-build` script (`prisma generate && prisma migrate deploy && tsc`) runs before the function is bundled — migrations therefore apply as part of every backend deploy.
- **Database**: Neon Postgres, linked via the `neon` CLI (`neon link`, config in `neon.ts`). `schema.prisma`'s datasource has both `url` (pooled, runtime) and `directUrl` (unpooled — required because Prisma migrations can't run over a pgbouncer connection).

Deploying the backend after a change: `cd backend && rm -rf dist && vercel deploy --prod --yes`. Env vars (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`) are already set on the Vercel project for production and preview; update via `vercel env add <NAME> <environment>`.

`CLIENT_ORIGIN` is a comma-separated allowlist checked with exact string matching in `backend/src/app.ts` — no wildcard/glob support, so a new frontend preview URL must be added explicitly.

See `README.md` for the full Neon → Vercel walkthrough.

## Architecture

### Auth & data model

JWT-based auth (`backend/src/lib/auth.ts`), no sessions/cookies — the frontend sends `Authorization: Bearer <token>` on every request (`frontend/src/lib/api.ts`'s `request()` helper attaches it automatically, and clears the stored session on a 401).

Two roles, two account-creation paths:
- **Teacher**: self-signup (`POST /api/auth/register-teacher`).
- **Student**: teacher-provisioned only, and only *through* a `Section` (`POST /api/sections/:id/students`) — there is no route to create a student outside a section. A `User.createdById` links a student back to the teacher who made them; `User.sectionId` links to their `Section`. A teacher owns their `Section`s via `Section.teacherId`. Every teacher-facing "list my students/sections/progress" query filters by one of these three FKs, and every mutation checks ownership first (see `sections.ts`'s `loadOwnedSection`, `auth.ts`'s reset-progress route) — a second teacher's request 404s rather than 403s, deliberately not revealing that the resource exists.

`ActivityRecord` (Predict/Observe/Explain/Reflection submissions) is the single source of truth for progress — there is no separate "progress" table or flag store. A module's stage is "done" for a student once a record with that `(userId, moduleId, stage)` exists. `frontend/src/App.tsx` derives all progress/lock UI from the in-memory `records` array via `stagesFor()`/`REQUIRED_STAGES` (`Predict`/`Observe`/`Explain` — `Reflection` is intentionally excluded, it's optional and never locks). Do not reintroduce a parallel progress flag; it drifted out of sync with actual submissions before (see git history around "Progress Summary").

Once a stage has a record, the frontend locks that Predict/Observe/Explain screen (replaces the form with a read-only view of what was submitted). The only way to undo this is a teacher's "Reset Progress" action (`POST /api/auth/students/:id/reset-progress`, optional `moduleId` for a single module vs. everything), which deletes the `ActivityRecord` rows server-side — and the matching `Feedback` rows (below) in the same scope, so a stale grade never outlives the submission it was for. `GET /api/sync/mine` is what makes a reset actually take effect on the *student's own device*: the client periodically reconciles its local record set against this authoritative server list (merging in only genuinely-unsynced local records) and re-derives lock state from the result.

### Grading & feedback

A `Feedback` row is one teacher's score (optional, 0–100) plus a required comment for one `(studentId, moduleId)` pair — `@@unique([studentId, moduleId])` means re-grading `upsert`s in place rather than accumulating a history; that matches the "teacher re-grades after a reset" workflow, not a graded-attempts log. Teachers grade from Classes → a section → an expanded student's module row (`POST /api/sections/:id/students/:studentId/modules/:moduleId/feedback`, ownership-checked the same way as everything else in `sections.ts`); grading is available as soon as *any* stage has a submission, not only after Explain. Students see feedback in three places, all reading the same `GET /api/sync/mine` feedback array: a "Graded" badge (with score) on each Home → Progress Summary row, and a "Teacher Feedback" card on the locked Predict screen and the Result screen — both wired off `activeModuleFeedback = myFeedback.find(...)`. A graded-but-not-yet-visited Home row is clickable (`openModuleProgress`) and routes to whichever of those screens actually shows the card, based on how far the student's stages go, rather than dumping them back into a fresh Predict form.

### Offline-first sync

Records are always written locally first (`frontend/src/lib/storage.ts`, IndexedDB with a `localStorage` fallback), then synced. Local storage is **scoped by `userId`** — the store holds every account that's ever logged in on that device (a shared classroom tablet), and every read/write filters by the current user's id, so switching accounts never leaks one student's progress into another's view. `syncUnsyncedRecords()` in `App.tsx` fires after every submission and on reconnect; it's best-effort and silent on failure (records stay local, retried later) — there's also a manual "Sync Saved Work" button in Settings as a fallback.

Several views poll (`LIVE_REFRESH_MS = 15000`) while mounted and online rather than only fetching once on navigation: the teacher's Class Progress (Home), Section roster (Classes), and a student's own `/sync/mine` reconciliation. This is what makes a teacher see new submissions, and a reset student see their screen unlock, without navigating away and back.

### Service worker

`frontend/public/service-worker.js`: network-first for navigations (falls back to cached `index.html` offline), stale-while-revalidate for everything else. `frontend/src/main.tsx` reloads the page on the SW's `controllerchange` event — without this, `skipWaiting()`/`clients.claim()` alone let a new SW take control in the background but never actually got the *already-open tab* to load the new JS, which is why deploys used to require a manual hard-refresh/cache-clear to show up. Bump `CACHE_NAME` in `service-worker.js` when changing the caching strategy itself (not needed for ordinary app changes — Vite's content-hashed filenames handle that).

### Frontend structure

`App.tsx` is a single large component holding all app state and every screen (`Screen` union type in `types/domain.ts`) — there's no router; navigation is a `screen` state variable plus a manual `history` stack (`goTo`/`goBack`). Role-conditional rendering (`isTeacherPreview = role === "teacher"`) branches within the same screens rather than separate teacher/student component trees — e.g. Home shows either "Progress Summary" or "Class Progress" from the same JSX block, and Predict/Observe/Explain show a "Teacher Preview" banner and skip persistence when a teacher is browsing a module instead of a student completing it (teacher entry point: "Preview Lessons" button on Home, since the Lessons tab itself is replaced by "Classes" for teachers).

`main.tsx` wraps `<App />` in `components/ErrorBoundary.tsx` — the app has no router and no per-screen isolation, so *any* uncaught render/effect exception anywhere unmounts the entire tree; the boundary shows a "Reload" screen instead of a silent blank page. This was added after a real bug of that shape (an AR cleanup crash that only surfaced once local `ScienceScene.tsx` state hit a specific timing edge) took down the whole app for every module after the first one. Treat "why is the screen blank" reports as an uncaught-exception hunt first — check the browser console — rather than assuming stale cache.

`ScienceScene.tsx` (three.js scene + AR.js marker tracking, via `lib/arjs.ts`) is `React.lazy()`-loaded from `App.tsx` rather than statically imported — three.js is only needed once a student reaches the Observe screen, and lazy-loading it keeps it (and AR.js, already dynamically imported inside `lib/arjs.ts`) out of the bundle everyone downloads just to log in. Both usages (the direct AR-mode render and `ActivityVisual`'s internal fallback-mode use of it) sit inside one `<Suspense fallback={null}>` around the Observe screen's `ar-frame` div — a Suspense boundary follows the render tree, so wrapping the outer usage covers the inner one too.

`data/modules.ts` lives in `backend/src/data`; `frontend/src/data/modules.ts` is just a one-line re-export of it (`export { modules } from "../../../backend/src/data/modules"`), so there's a single source of truth for module content — no manual sync needed. It's the bundled fallback module library used when the API is unreachable, and also what the backend seeds into Postgres via `POST /api/modules/seed`.

### Backend structure

Thin Express app (`app.ts`) mounting per-resource routers (`routes/*.ts`); `lib/auth.ts` has the `requireAuth`/`requireRole` middleware, `lib/validation.ts` has shared zod schemas (username/password), `lib/prisma.ts` exports the singleton `PrismaClient`. `lib/database.ts`'s `hasDatabaseUrl()` gate is checked at the top of most routes so the API degrades gracefully (serves bundled fallback data, or 503s on writes) if `DATABASE_URL` is unset.
