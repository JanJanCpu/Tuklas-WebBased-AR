# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It also records the project history and decisions so a fresh session (or a human) can pick up without the old chat.

## What this is

Tuklas AR Science Lab: an offline-first WebAR PWA for Grade 9 Predict-Observe-Explain (POE) science activities, with marker-based AR (AR.js) and a Three.js 3D fallback. npm workspaces monorepo: `frontend` (React 19 + Vite + TypeScript) and `backend` (Express + TypeScript + Prisma/PostgreSQL).

Capstone: "Development of an Offline Augmented Reality Science Laboratory Simulator Using the Prediction-Observation-Explanation Approach for Resource-Limited Public Grade 9 Classrooms in Manila." Authors: Jan Aldridge S. Pesa (BSIT, PLM, the user of this fork) and Earl Stephen E. Dulay (owns the original repo and frontend deployment). Adviser: Dr. Criselle J. Centeno. The thesis was **defended in September 2026**.

## Project phases and current state

1. **Pre-defense (done):** thesis audit against the code, research instruments, real bug fixes, Chapter 4/5 written from real data only, Appendices A-E. Never fabricate results, scores or logs; every number in the thesis comes from the real pilot data.
2. **Post-defense (in progress):** the teacher wants the AR more dynamic ("Pokemon GO level", less flat and static, replacing physical lab objects, hand/touch manipulation). All of this lives on the fork branch `feature/dynamic-ar`. Latest build label: **b27**.

Open items:
- Phone test of Redmi A3 with `?fps=1&q=2` (expect readout `q2 d2 t320`): does 320x240 tracking reach 24+ fps with a steady marker?
- Is the Earth (2.2) mini-globe legible on a phone? Do the circuit gestures feel right?
- Decide the fate of the 31 MB `frontend/public/mediapipe/` hand-tracking files (drop them if hand mode is abandoned).
- Permanent CORS wildcard for `tuklas-web-based-ar-frontend-*-tuklasar.vercel.app` was offered, not applied (would need code, since the allowlist is exact-match).
- Optional: open-source 3D models; a PR back to the friend's repo once devices are re-tested.
- If the upgraded build is reported in the thesis or paper, re-measure Redmi A3 / Poco C65 (see the fps table below).

## Fork workflow (IMPORTANT)

The original repo (`earldulay/Tuklas-WebBased-AR`) and its frontend Vercel project belong to the co-author. Do not experiment there.
- Remotes: `origin` = `JanJanCpu/Tuklas-WebBased-AR` (the fork), `upstream` = `earldulay/Tuklas-WebBased-AR`.
- Tag `defended-2026-09` = defended commit `2982fc6`. Keep `main` unchanged until devices are re-tested; do experimental work on `feature/dynamic-ar`.
- Frontend test URLs: stable branch alias `https://tuklas-web-based-ar-frontend-git-feature-dynamic-ar-tuklasar.vercel.app` (auto-builds the branch; Vercel SSO protects previews, so the viewer must be logged in to Vercel). Fork main: `https://tuklas-web-based-ar-frontend-nine.vercel.app`. Friend's original: `https://tuklas-web-based-ar-frontend.vercel.app`. **Per-deployment preview URLs change every push and are not in the CORS allowlist; always use the stable alias.** "Login failed / Check your connection" almost always means the phone is on a non-allowlisted URL.
- The backend and Neon DB are shared with the defended system; use test accounts only. Neon snapshot `post-defense-backup-2026-09-19` (project `round-poetry-34806070`, only 6 hours of history retention) protects the pilot data.

### Adding a CORS origin
`CLIENT_ORIGIN` is a comma-separated, exact-match allowlist stored as a hidden Vercel secret (cannot be read back). To add one, replace the whole value: `vercel env rm CLIENT_ORIGIN production --scope tuklasar` then `vercel env add CLIENT_ORIGIN production --scope tuklasar` with the full list (friend's URL, `-nine`, feature-branch alias, `http://localhost:5173`, plus the new one), redeploy the backend, then verify: `curl -i -X OPTIONS https://tuklas-backend-two.vercel.app/api/auth/login -H "Origin: <url>" -H "Access-Control-Request-Method: POST"` and look for `access-control-allow-origin`.

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

There is no test suite and no lint script. Verification is `npm run typecheck` plus `npm run build`, plus the visual harness below for 3D scene work.

**Windows dev gotcha**: `npm run dev:backend` runs `tsx watch`, which on Windows can leave an orphaned `node.exe` bound to port 4000 that survives stopping the task. If `prisma generate`/`migrate` fails with `EPERM: ... query_engine-windows.dll.node` or `dev:backend` fails with `EADDRINUSE`: `netstat -ano | grep ":4000"` then `taskkill //PID <pid> //F`.

**Shell gotcha**: very long heredocs with quotes break in the Bash tool. For big code patches, write a Python patch script with the Write tool (asserting each `old` string occurs exactly once) and run it with `python`.

## Deployment topology

Three independently deployed pieces:
- **Frontend**: static Vite build on Vercel. The original project is the co-author's; the user has their own on team `tuklasar` (see fork workflow).
- **Backend**: separate Vercel project `tuklas-backend` (team `tuklasar`), serverless, live at `https://tuklas-backend-two.vercel.app`. The Express app is NOT deployed as-is: `backend/api/index.js` (plain JS) imports the `tsc`-compiled `dist/app.js` and exports it as the Vercel function; `backend/vercel.json` sets `framework: null` (Vercel's Express auto-detection otherwise builds `src/app.ts` directly and fails on a `helmet` import-interop error) plus a catch-all rewrite. `backend/public/index.html` is a placeholder for Vercel's static-output check. The `vercel-build` script (`prisma generate && prisma migrate deploy && tsc`) runs before bundling, so migrations apply on every backend deploy.
- **Database**: Neon Postgres, linked via the `neon` CLI (`neon link`, config in `neon.ts`). `schema.prisma` has both `url` (pooled, runtime) and `directUrl` (unpooled; Prisma migrations cannot run over pgbouncer).

Deploy the backend after a change: `cd backend && rm -rf dist && vercel deploy --prod --yes --scope tuklasar`. `--scope tuklasar` is required; without it the CLI uses the personal context and fails with "Not authorized". Env vars (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`) are set on the Vercel project for production and preview; update with `vercel env add <NAME> <environment> --scope tuklasar`.

GitHub to Vercel auto-deploy is **not** connected for the backend (`vercel git connect --scope tuklasar` fails because the Vercel GitHub App is not authorized for this repo under the `tuklasar` account), so every backend change needs the manual command above. The frontend fork project does auto-build from GitHub pushes.

See `README.md` for the full Neon to Vercel walkthrough.

## Architecture

### Auth & data model

JWT auth (`backend/src/lib/auth.ts`), no sessions/cookies; the frontend sends `Authorization: Bearer <token>` (`frontend/src/lib/api.ts`'s `request()` attaches it and clears the stored session on a 401).

Two roles:
- **Teacher**: self-signup (`POST /api/auth/register-teacher`).
- **Student**: teacher-provisioned only, and only through a `Section` (`POST /api/sections/:id/students`). `User.createdById` links a student to the teacher; `User.sectionId` to their `Section`; `Section.teacherId` to the owner teacher. Every teacher-facing list filters by one of these FKs and every mutation checks ownership first (`sections.ts`'s `loadOwnedSection`, the reset-progress route). A second teacher's request 404s rather than 403s, deliberately.

`ActivityRecord` (Predict/Observe/Explain/Reflection submissions) is the single source of truth for progress. A stage is "done" once a record with that `(userId, moduleId, stage)` exists. `frontend/src/App.tsx` derives all progress/lock UI from the in-memory `records` array via `stagesFor()`/`REQUIRED_STAGES` (Predict/Observe/Explain; Reflection is optional and never locks). Do not reintroduce a parallel progress flag; it drifted out of sync before.

Once a stage has a record the frontend locks that screen (read-only view). The only undo is a teacher's "Reset Progress" (`POST /api/auth/students/:id/reset-progress`, optional `moduleId`), which deletes the `ActivityRecord` rows and the matching `Feedback` rows in the same scope. `GET /api/sync/mine` makes a reset take effect on the student's own device: the client periodically reconciles local records against this authoritative list (keeping only genuinely-unsynced local records) and re-derives lock state.

### Grading & feedback

A `Feedback` row is one teacher's optional score (0-100) plus a required comment for one `(studentId, moduleId)`; `@@unique([studentId, moduleId])` means re-grading upserts in place. Teachers grade from Classes → a section → an expanded student's module row (`POST /api/sections/:id/students/:studentId/modules/:moduleId/feedback`), available once *any* stage has a submission. Students see it as a "Graded" badge with score on Home → Progress Summary, and a "Teacher Feedback" card on the locked Predict screen and the Result screen (`activeModuleFeedback = myFeedback.find(...)`). A graded-but-unvisited Home row is clickable (`openModuleProgress`) and routes to whichever screen shows the card.

### Offline-first sync

Records are written locally first (`frontend/src/lib/storage.ts`, IndexedDB with `localStorage` fallback), then synced. Local storage is **scoped by `userId`** (shared classroom tablets); every read/write filters by the current user. `syncUnsyncedRecords()` in `App.tsx` fires after every submission and on reconnect, is best-effort and silent on failure; Settings has a manual "Sync Saved Work" button. Several views poll (`LIVE_REFRESH_MS = 15000`) while mounted and online: teacher Class Progress, Section roster, and the student's `/sync/mine` reconciliation.

### Service worker and precache

`frontend/public/service-worker.js` is **cache-first for known assets with an SPA fallback** (`isSpaRoute` applies only when the path is not in the asset list). The Vite plugin `offlineBundle` in `frontend/vite.config.ts` walks `dist` and injects the asset list; the cache is versioned `tuklas-webar-<hash>`, `prepare()` downloads missing assets, and the page can send a `CACHE_NOW` message. `frontend/src/main.tsx` reloads on the SW's `controllerchange` so an open tab picks up the new JS.

Every app update re-downloads the whole precache. Files under `mediapipe/` are **excluded** from the precache list (they were 60 MB of the precache and caused stale phone builds because downloads never finished). If a phone shows an old build, clear site data or reinstall. Bump the cache name only when the caching strategy itself changes.

### Frontend structure

`App.tsx` is one large component holding all state and every screen (`Screen` union in `types/domain.ts`); no router, navigation is a `screen` state plus a manual `history` stack (`goTo`/`goBack`). Role-conditional rendering (`isTeacherPreview = role === "teacher"`) branches inside the same screens (teacher entry point: "Preview Lessons" on Home; Predict/Observe/Explain show a "Teacher Preview" banner and skip persistence). The Observe screen passes `onControlChange` (sets control A/B) and `onLabChange` (merges into `lab`) to `<ScienceScene>`.

`main.tsx` wraps `<App />` in `components/ErrorBoundary.tsx` (shows a "Reload" screen instead of a blank page). Treat "blank screen" reports as an uncaught-exception hunt first (browser console), not stale cache.

`ScienceScene.tsx` is `React.lazy()`-loaded from `App.tsx` inside one `<Suspense fallback={null}>` around the Observe screen's `ar-frame` div (covers `ActivityVisual`'s inner fallback use too). `data/modules.ts` lives in `backend/src/data`; `frontend/src/data/modules.ts` re-exports it, giving one source of truth (bundled fallback library, also seeded to Postgres via `POST /api/modules/seed`). 12 modules: inertia, force-mass, launcher, series, parallel, home-circuit, seismic, earth-scale, replication, mutation, chemical-change, bonding.

### Backend structure

Thin Express app (`app.ts`) mounting per-resource routers (`routes/*.ts`); `lib/auth.ts` (`requireAuth`/`requireRole`), `lib/validation.ts` (zod schemas), `lib/prisma.ts` (singleton client). `lib/database.ts`'s `hasDatabaseUrl()` gate degrades gracefully (fallback data or 503 on writes) without `DATABASE_URL`.

## Dynamic AR system (post-defense work, branch `feature/dynamic-ar`)

### Scene code: `frontend/src/components/experimentScene.ts`
All 3D scene content. `createExperimentScene(root, id)` returns `run(time, a, b, lab)` plus `{ setLite, interact }`. `a`/`b` are the two slider controls (ranges come from `controls` in `lib/experiments.ts`); `lab` is `LabState { closed, branchMask, electrons, basePairs, layers }`. Helpers: `mesh(...)` (registers in `registry` so `setLite` can swap materials), `sphere`, `instanced(...)` (instanced meshes to cut draw calls; returns `place/hide/tint`), `line`, `label`, `glow`, `arrow`, `wire(points, parent, gaps)` (cylinder wire with gap cutouts). Interfaces `Interaction` (`targets`, `down`, `move`, `up`, `cancel`) and `InteractionApi` (`values()`, `setControl`, `setLab`).

Per-module content and gestures:
- **cart** (inertia, force-mass, launcher): wagon, arrows, blocks, balloon/air puffs, speed streaks (no white rim on the wagon, streaks are fine). Drag the arrow = force (`a`), drag the cart = mass (`b`, inertia), tap the cart = mass (force-mass). **Launcher (1.3):** the balloon is a lathe-turned teardrop with a nozzle at the back of the tray; it empties once over `BURN` = 4 s (fast at first, then slow), flutters at the nozzle, then sags. Thrust only acts while there is air, so after that the cart coasts at the speed it reached (the reaction arrow disappears and the label says so). Tap the balloon (or drag the arrow) to refill and relaunch via `api.restart()`.
- **circuits** (series, parallel, home-circuit): board 5.6x3.7, round white E27-style lamp holders with upright screw-in bulbs (`bodies[]` groups, `ROW=0.15`, `LIFT=0.64`, `PARALLEL_SCALE=0.68`), battery holder with 3 cells at x -0.6/0/0.6, hinged switch lever (SW0=1.35, SW1=1.85, y -1.15). Gestures: drag/tap the lever, drag a cell or bulb out to remove it, tap or drag its ghost to add it back. Wire gaps exist for the battery holder and switch.
- **chemical-change**: bench, beaker, draggable bottle/jar, instanced foam and bubbles.
- **bonding**: shell rings; draggable electron token and pair token.
- **seismic**: strikes list with an automatic schedule (period 3.6 s for S, 2.2 s for P), hammer with wind-up/swing (0.3 s)/recoil timeline, station, rock, waves, drag-to-pull hammer; trace at z=-0.02, `COLS=24`, `K=5`, `TRACE=100`.
- **earth-scale**: cutaway globe (R=1.75), shells, faces, ghost wireframe, chips; tapping opens a magnified surface slab (rock textures, brackets, "Mantle to 2,891 km" with a fading orange mantle block) plus a small clone of the same globe with a red marker, line and "Zoomed in here" label.
- **replication**: real twisting double helix (instanced rungs/joints/links, letter sprites). "Separate and copy" unzips it from the left; a new strand (orange backbone) builds on each old one (blue), so both daughters visibly keep one old strand (semiconservative). Student choices from the workbench (`lab.basePairs`) colour the new bases (grey `?` = unset, red = wrong). Gestures: pull the helix apart (or tap it) to separate/rejoin; when separated, drag an A/T/C/G token from the tray onto a new-strand slot (a glow shows the target; a wrong base turns red and can be replaced), tap a placed base to take it back.
- **mutation**: two helices sharing one x scale (original above, edited below) with codon bands and a protein bead chain under each (edited beads turn orange where the amino acid changed, red for STOP). Each original base keeps its own piece, so an insertion or deletion slides every later base along and the codons regroup; the removed base lifts out, the changed/added base glows. Tap a base, or slide a finger along the original row, to pick `Base position` (caret marks it); tap the chip under the scene to cycle the mutation type.

### `ScienceScene.tsx`
Three.js 0.164.1 + AR.js scene. Studio environment lighting + ACES tone mapping. Generic pointer input: pointer raycast to the scene's table plane, `touch-action: pan-y` plus a touchmove `preventDefault` only while grabbing (so scrolling still works, and dragging is not cancelled by scroll on phones), relative pull from the grab point. Camera framing (`sceneBounds`, `frameScene`) fits measured bounds over sampled times and both extremes of control A. `viewMode "fallback"` (3D mode) uses a LIGHT background (`.ar-frame.fallback-mode`).

### Quality levels (0-3) and diagnostics
Auto step-down when fps stays under 19, persisted in `localStorage` as `tuklas-quality-v2`:
- 0 full; 1 marker detection every 2nd frame; 2 pixelRatio 1 + 320x240 tracking canvas (`trackingSize`, `trackingLow` state); 3 Lambert (cheaper) shading.

URL parameters: `?fps=1` (HUD: `render N fps | hands N fps | N ms DELEGATE | state | qN dN tNNN[ empty] | bNN`), `?q=<0-3>` force a level, `?detect=<n>` detect every n frames, `?empty=1` empty scene (isolates tracking cost), `?hands=1|cpu` hand-tracking spike. The HUD build label (currently `b27`, a string in `ScienceScene.tsx`) is how you confirm a phone loaded the new build; bump it on every change you want to verify remotely.

### Hand tracking (experimental, probably to be dropped)
`lib/handTracking.ts` wraps MediaPipe Hand Landmarker (lazy import, GPU then CPU fallback, pinch hysteresis). Accurate but **not viable on budget phones**: Poco C65 GPU 5-10 fps render and 160-330 ms per detection; CPU worse (1-3 fps while tracking). Decision: touch manipulation is the main interaction; hand mode only for strong phones. Model files (~31 MB) live in `frontend/public/mediapipe/` and `@mediapipe/tasks-vision` is in `frontend/package.json`; excluded from the precache. Candidate for removal.

### Measured performance
- Marker tracking (AR.js) is the frame-rate ceiling on weak phones, not rendering.
- Redmi A3: about 10 fps at 640x480 every frame; about 20 with every-2nd-frame; after quality tuning all scenes 17-21 fps. The 320x240 tracking option (b23+) still needs a phone test.
- Poco C65: 22-25 fps at room temperature. Cold phones behave differently; test at room temperature.
- iPhone 16 Plus: 60 fps (the thesis originally mis-stated 23; corrected in B.9-B.11 and Table 4.3).
- Target: 24 fps.

### Local visual harness (untracked, excluded from git)
`frontend/harness.html` and `frontend/src/harness.tsx` render one scene by URL (`?m=<module>&ar=1&fps=1&q=2&light=1&w=&h=`) for screenshot testing with `puppeteer-core` + Chrome + SwiftShader (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, fake media stream flags for camera). Use `light=1` for element screenshots on the light background. Scripts (`snap.js`, `drag.js`, `burst.js`, `frames.js`, `artest.js`, `hammer_sim*.js`) and the round-by-round patch scripts are in the backup folder (see below). If the harness files are missing, recreate them; they are simple wrappers around `<ScienceScene>`.

## Thesis and capstone artifacts

Everything below was produced with Claude in the original session and is **not in this repo**. It is backed up at `C:\Users\User\Documents\Tuklas-Capstone-Backup\` (see its `README.md`):
- Letters 1-5 (validation request, school request, parental consent, student assent, certificate of validation) as md + PDF.
- Google Forms specs (pilot test, module validation instrument, pretest/posttest item bank with matching posttest stems and shuffled choices, SUS), participation observation checklist, figures 3.13-3.16 (SVG), `module-validation-instrument.html`.
- Appendix A-E cards (PNG/HTML): SOP1 scores/tables, SOP2 device logs (B.6-B.14, Poco C65, Redmi A3, iPhone 16 Plus; online/offline/full-offline), SOP3 curriculum alignment (B.15-B.19), tester photo grids, Table 4.3, SUS for all 10 students.
- Text drafts extracted from the chat: Chapter 4 (4.1-4.2.1, 4.2.2 device logs + SUS, SOP3 localization revision meaning alignment to the MATATAG curriculum), Chapter 5 with every claim tied to a measured result, the curated APA reference list (Brooke 1996, Bangor/Kortum/Miller 2009, etc.), journal paper draft (Appendix D), bionote (Appendix E).
- Statistics used: paired t-test, Cohen's d, Wilcoxon, SUS scoring.
- Writing style the user wants: plain, no em-dashes, no AI tone.

## Decisions and gotchas worth remembering

- Phone testing needs the stable branch alias (CORS). Preview URLs per push fail login.
- Chrome `--print-to-pdf` adds a footer; use Puppeteer with `displayHeaderFooter: false` for PDFs.
- Puppeteer element screenshots of the Earth ghost wireframe blank out on dark backgrounds; use `light=1`.
- z-fighting: keep the seismic trace at z=-0.02; the jagged wave was fixed with 24 columns, K=5 and a longer pulse.
- The "frame skipped" hammer was an animation timeline bug (angle snapping to 0); the fix is wind-up, swing, recoil with grab continuity, verified by frame simulation.
- If a visual change "did nothing", suspect a stale phone build (check the HUD build label) before changing code.
- User preferences: realistic lab parts (they supplied a photo of a round E27 lamp holder), touch/drag gestures, and "do what you think is best" for design details. Confirm before anything outward-facing (pushing to the friend's repo, changing production).
