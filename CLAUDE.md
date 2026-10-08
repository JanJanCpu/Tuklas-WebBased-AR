# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It also records the project history and decisions so a fresh session (or a human) can pick up without the old chat.

## What this is

Tuklas AR Science Lab: an offline-first WebAR PWA for Grade 9 Predict-Observe-Explain (POE) science activities, with marker-based AR (AR.js) and a Three.js 3D fallback. npm workspaces monorepo: `frontend` (React 19 + Vite + TypeScript) and `backend` (Express + TypeScript + Prisma/PostgreSQL).

Capstone: "Development of an Offline Augmented Reality Science Laboratory Simulator Using the Prediction-Observation-Explanation Approach for Resource-Limited Public Grade 9 Classrooms in Manila." Authors: Jan Aldridge S. Pesa (BSIT, PLM, the user of this fork) and Earl Stephen E. Dulay (owns the original repo and frontend deployment). Adviser: Dr. Criselle J. Centeno. **Defense is scheduled for October 2026 (2nd or 3rd week), not yet held.** Earlier notes in this file said "defended in September 2026" — that was wrong; correct as of 2026-09-28.

## Project phases and current state

This is **pre-defense**, in a dedicated polish window before the panel and before school testing:
1. Thesis audit against the code, research instruments, and Chapter 4/5 drafted from real data only are done. Never fabricate results, scores or logs; every number in the thesis comes from the real pilot data.
2. **Now (through the polish window):** the adviser/panel wants the AR more dynamic ("Pokemon GO level", less flat and static, replacing physical lab objects, hand/touch manipulation) and the general app UI polished, before the upgraded build is used for real SOP1/2/3 testing at Antonio A. Maceda Integrated School (letters 1/2/6 are for arranging that testing) and before the October defense. All of this lives on the fork branch `feature/dynamic-ar`. Latest build label: **b40**.
3. **After school testing, before the defense:** the real data from that testing (curriculum validation, pretest/posttest, SUS) needs to go into Chapter 4/5 and the appendices, replacing/extending whatever pilot data is there now.

Open items:
- Done 2026-10-09 over USB (see Measured performance): Redmi A3 fps at q2, Earth 2.2 legibility (labels enlarged, b39), circuit gestures (small-target tap fix, b40). Account features also passed end to end on the phone (bulk add with plain and SF1 names, logins, New Password invalidates the old one, SMS opens Messages and Email opens Gmail with the login typed in); printing slips on Android gave a blank 2nd page, fixed by `min-height: 0` on `body.printing-slips` (`body` is `min-height: 100vh`).
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

### Phone testing over USB (no Vercel login)
Vercel SSO on preview URLs can block phone testing. Instead: `VITE_API_URL=https://tuklas-backend-two.vercel.app/api npx vite build` in `frontend`, then `npx vite preview --host 127.0.0.1 --port 5173 --strictPort` (IPv4 matters: `adb reverse` connects to 127.0.0.1 and Vite otherwise binds only `::1`), then `adb reverse tcp:5173 tcp:5173` and open `http://localhost:5173/?fps=1&q=2` on the phone (localhost is in the CORS allowlist and counts as a secure context for the camera). `adb forward tcp:9222 localabstract:chrome_devtools_remote` gives CDP into phone Chrome; `adb shell input tap/swipe` sends real touches. adb is at `%LOCALAPPDATA%/Android/Sdk/platform-tools`.

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

Account distribution (panel question, 2026-10-08): no automatic SMS or email service. That would mean paying per message, collecting minors' contact details under RA 10173, and relying on students having their own phone or email. Instead, a section screen has "Add Whole Class": the teacher pastes the class list (plain names or SF1 `LAST, FIRST M.` style), `lib/credentials.ts` generates a username (`juan.delacruz482`, retried on a 409) and a word+4-digit password, the frontend loops the existing create-student endpoint, and the logins become printable A4 cut-out slips (`.slip-sheet`, portalled next to `#root`, shown only under `body.printing-slips`). Slip passwords live in React state only, never in storage, and can't be shown again; a lost slip means using "New Password" on that student (`POST /api/sections/:id/students/:studentId/password`), which adds a fresh slip. Each pending slip also has SMS and Email buttons: `sms:?&body=` and `mailto:` links that open the teacher's own Messages or email app with the login typed in, so sending costs the school nothing and no number or address is stored.

`ActivityRecord` (Predict/Observe/Explain/Reflection submissions) is the single source of truth for progress. A stage is "done" once a record with that `(userId, moduleId, stage)` exists. `frontend/src/App.tsx` derives all progress/lock UI from the in-memory `records` array via `stagesFor()`/`REQUIRED_STAGES` (Predict/Observe/Explain; Reflection is optional and never locks). Do not reintroduce a parallel progress flag; it drifted out of sync before.

Once a stage has a record the frontend locks that screen (read-only view). The only undo is a teacher's "Reset Progress" (`POST /api/auth/students/:id/reset-progress`, optional `moduleId`), which deletes the `ActivityRecord` rows and the matching `Feedback` rows in the same scope. `GET /api/sync/mine` makes a reset take effect on the student's own device: the client periodically reconciles local records against this authoritative list (keeping only genuinely-unsynced local records) and re-derives lock state.

### Grading & feedback

A `Feedback` row is one teacher's optional score (0-100) plus a required comment for one `(studentId, moduleId)`; `@@unique([studentId, moduleId])` means re-grading upserts in place. Teachers grade from Classes → a section → an expanded student's module row (`POST /api/sections/:id/students/:studentId/modules/:moduleId/feedback`), available once *any* stage has a submission. Students see it as a "Graded" badge with score on Home → Progress Summary, and a "Teacher Feedback" card on the locked Predict screen and the Result screen (`activeModuleFeedback = myFeedback.find(...)`). A graded-but-unvisited Home row is clickable (`openModuleProgress`) and routes to whichever screen shows the card.

### Offline-first sync

Records are written locally first (`frontend/src/lib/storage.ts`, IndexedDB with `localStorage` fallback), then synced. Local storage is **scoped by `userId`** (shared classroom tablets); every read/write filters by the current user. `syncUnsyncedRecords()` in `App.tsx` fires after every submission and on reconnect, is best-effort and silent on failure; Settings has a manual "Sync Saved Work" button. Several views poll (`LIVE_REFRESH_MS = 15000`) while mounted and online: teacher Class Progress, Section roster, and the student's `/sync/mine` reconciliation.

### Service worker and precache

`frontend/public/service-worker.js` is **cache-first for known assets with an SPA fallback** (`isSpaRoute` applies only when the path is not in the asset list). The Vite plugin `offlineBundle` in `frontend/vite.config.ts` walks `dist` and injects the asset list; the cache is versioned `tuklas-webar-<hash>`, `prepare()` downloads missing assets, and the page can send a `CACHE_NOW` message. `frontend/src/main.tsx` reloads on the SW's `controllerchange` so an open tab picks up the new JS.

Every app update re-downloads the whole precache. (The `mediapipe/` hand-tracking model files, once 60 MB of the precache and a cause of stale phone builds, are gone as of 2026-10-08 - see Hand tracking below.) If a phone shows an old build, clear site data or reinstall. Bump the cache name only when the caching strategy itself changes.

### Frontend structure

`App.tsx` is one large component holding all state and every screen (`Screen` union in `types/domain.ts`); no router, navigation is a `screen` state plus a manual `history` stack (`goTo`/`goBack`). Role-conditional rendering (`isTeacherPreview = role === "teacher"`) branches inside the same screens (teacher entry point: "Preview Lessons" on Home; Predict/Observe/Explain show a "Teacher Preview" banner and skip persistence). The Observe screen passes `onControlChange` (sets control A/B) and `onLabChange` (merges into `lab`) to `<ScienceScene>`.

`main.tsx` wraps `<App />` in `components/ErrorBoundary.tsx` (shows a "Reload" screen instead of a blank page). Treat "blank screen" reports as an uncaught-exception hunt first (browser console), not stale cache.

`ScienceScene.tsx` is `React.lazy()`-loaded from `App.tsx` inside one `<Suspense fallback={null}>` around the Observe screen's `ar-frame` div (covers `ActivityVisual`'s inner fallback use too). `data/modules.ts` lives in `backend/src/data`; `frontend/src/data/modules.ts` re-exports it, giving one source of truth (bundled fallback library, also seeded to Postgres via `POST /api/modules/seed`). 12 modules: inertia, force-mass, launcher, series, parallel, home-circuit, seismic, earth-scale, replication, mutation, chemical-change, bonding.

### App-wide UI polish (2026-09-28)
Follow-up pass: every raw `&gt;`/`&lt;` text-glyph chevron (back button, module/settings rows, disclosure triangles) is now a `lucide-react` `ChevronRight`/`ChevronLeft` icon. The back button had a real bug worth remembering: `.back-button` never had `display:grid; place-items:center` (it just inherited a shared pill rule with `status-button`/`logout-button`, which are text-sized so the gap never showed), so the "<" glyph sat wherever the browser's default button box model put it - fixed by giving `.back-button` its own explicit 38x38 centered box. A shared `.row-chevron` class keeps every row arrow the same size/colour.

Design-critique follow-through (2026-10-02): counted every `.eyebrow` label (27 uses) and found only 2 were pure duplicates of an adjacent heading ("My Class"/"Class Progress", "AR Marker"/"Printable and downloadable marker") - removed just those two; the other 25 genuinely label something the heading doesn't say and were kept, correcting an initial overestimate that "most" were redundant. Gave the Home screen's hero card (`.overall-progress`, the Class Progress / Progress Summary card) a gold top border and a heavier shadow than every other card, and lightened the shared `--shadow` token so the rest read as quieter by comparison - "spend boldness in one place" instead of every card at the same visual weight. Added a self-hosted display typeface: `Lexend` (a reading-proficiency typeface, a deliberate choice for an education app, not a cosmetic one), Latin-subsetted to ~20KB (`frontend/public/fonts/lexend-800.woff2`, precached like everything else, no network request at runtime), used in exactly two places - `h1` and the Home hero stat number (`.overall-progress .overall-percent`) - not applied broadly, so it reads as one deliberate accent rather than a themed-everything typeface swap.

Further pass: the three `teacher-preview-note` banners now lead with a lucide `Eye` icon instead of plain text. `.primary-button` has a soft blue drop shadow (deepens on hover) instead of a flat fill. Clickable surfaces (`.module-card`, `.settings-row`, `.task-card`, `.account-indicator`) lift with a stronger shadow on hover and scale down slightly on `:active`, gated behind `@media (hover: hover) and (pointer: fine)` so it never triggers a sticky hover state on touch. Verified the hover lift and the button shadow with real screenshots (mouse `hover()`, not just CSS review).
`styles.css` has one shared `--radius: 14px` token (was a flat 8px on every card, button and input; small circular/pill chips like nav badges keep their own `50%`/`999px` radius, untouched). Bottom nav (`App.tsx`) shows a `lucide-react` icon above each label (`Home`/`BookOpen`/`Users`/`Settings`) instead of text alone, with a small scale/colour transition on the active tab. The landing screen's Predict/Observe/Explain strip (`.landing-flow`) was previously three plain boxes that looked like dead buttons; it's now a non-interactive numbered step diagram (circle badge + connecting line + one-line hint per step) so it doesn't imply it's tappable. Deliberately left alone: the navy/red/gold PLM palette (institutional branding, keep it) and the system font stack (a custom webfont would bloat the offline precache). A short fade/rise-in (`screen-enter` keyframes, `prefers-reduced-motion` respected) now plays on `.screen.active` every time a screen mounts, since only one is ever mounted at a time (`screen === "x" && (...)` in `App.tsx`, not a hide/show toggle of siblings) - so this is an entrance animation, not a cross-fade between old and new. Empty/loading state copy was checked and is already fine ("No experiments completed yet.", etc.); the one nit found ("module(s)" pluralization on the Modules screen) was left alone, unasked.

### "Feels lacking" pass (2026-10-02)
Asked for a redesign; chose to push the current direction further rather than restructure, given the app is about to go into real school testing. Investigated the Home screen's apparent dead space between progress sections first - measured it with real DOM rects rather than guessing, and it's not a bug (18px gaps match the CSS exactly); it only looked sparse because the demo account has zero real progress. Left it alone.

The real finding: the UI used navy pervasively but never used the brand's red or gold except as single accents, and every module icon was the same blue tint regardless of subject - a missed, genuinely useful opportunity, not just decoration. Added a subject-colour system keyed off each module's existing `groupId` (`motion`/`electricity`/`earth-space`/`life`/`materials`, from `backend/src/data/modules.ts`): `ModuleIcon` (`App.tsx`) now emits `subject-${groupId}` alongside `module-icon`, and five `.subject-*` CSS rules tint the icon badge per strand - motion keeps the house blue (most frequent strand), materials reuses the brand red (chemistry), electricity/earth-space/life are three new but palette-consistent accents (desaturated teal/amber/green, not a bright rainbow set). This single component change colours icons across Home, the quarter-group list, and the module list at once. Also restyled the Modules breadcrumb (`.curriculum-breadcrumb`): it was default-blue-underlined links with a literal "/" separator; now a `ChevronRight` icon separator, muted inactive crumbs, bold dark "current" crumb - matches the row-chevron icon language already used elsewhere instead of looking like unstyled browser chrome.

### "Look modern" pass (2026-10-02, same day as the subject-colour pass)
Asked to make the UI modern a third time after prior polish rounds; decided without re-asking what "modern" meant and went bolder on the things left conservative so far:
- Cards (`.panel-card`/`.module-card`/`.settings-row`/etc.) dropped their visible `1px solid var(--line)` border for a near-invisible `rgba(15,76,154,0.05)` one plus a stronger `--shadow` (0.08 → 0.1 opacity) - edges are drawn by shadow, not a hard line, but not literally borderless, since a washed-out budget-phone screen in daylight needs *some* edge definition or cards disappear against `--surface`.
- `.primary-button` background and `.progress-track span` fill are now subtle gradients (`var(--blue)` → `var(--blue-dark)` / a lighter blue) instead of flat fills - both verified by screenshot since 0% progress makes the gradient invisible by default (forced a non-zero width via `page.evaluate` to check it).
- `.screen-stack` padding and `.screen` gap both went up slightly for more breathing room between sections.
- Left alone on purpose: the header's solid gold bottom border - that's a brand identity marker, not a flat-design leftover, and not every flat color needs a gradient.

### "Fresh look" pass - AR viewfinder identity (2026-10-02)
After three rounds of polish the user said it still looked the same - fair, since every prior round kept the same bones (card stack, navy/red/gold) and just refined depth/spacing/colour. This pass changes what the UI actually signals: nothing in it said "this is an AR app" before. Added a reusable `.scan-corner` motif (four real `<span class="scan-corner tl/tr/bl/br">` elements, gold `border-top`+`border-left` etc., not a CSS trick) that reads as AR-viewfinder/camera-reticle brackets, used in exactly two places so it reads as one deliberate identity rather than decoration sprinkled everywhere: the login hero (`.landing-hero`, plus a small circular `ScanLine` icon badge above the eyebrow) and `.ar-frame` (the actual camera/3D observation viewport on the Observe screen) - the same visual language that introduces the app is the language the app uses once you're actually observing a trial.
Real bug caught before shipping: `.scan-corner` needs an explicit `z-index` (set to 5) because `.three-scene` and its `canvas` already use `z-index: 1`/`z-index: 2 !important` (`ScienceScene.tsx`'s mount styling) - without it the brackets would render *behind* the live camera feed/3D canvas, invisible. Verified this specifically by injecting the corner markup into the harness over a live fake-camera feed (`?ar=1`, Puppeteer's `--use-fake-device-for-media-stream`) and screenshotting it, not just checking the login screen where there's no competing canvas to hide behind.

### Sticky AR camera view (2026-10-02)
The Observe screen's camera/3D viewport used to scroll away like any other card, so a student scrolling down to read the Observation Prompt, adjust sliders, or reach "Run Trial" lost sight of the live feed and the marker-detection status entirely - including while "Run Trial" is disabled specifically because the marker isn't detected yet, so they couldn't see *why* it was disabled once scrolled past the camera.

`.ar-frame-sticky` (`App.tsx`, wraps `.ar-frame` + `.camera-status`) is now `position: sticky`, but it had to be a **sibling** of `.ar-panel`, not nested inside it - a `position: sticky` element only stays pinned while scrolling through its own parent's height, and `.ar-panel` (just the "Camera Mode" heading row) was too short to span the long Observation Prompt card below it; the sticky element unstuck and scrolled away with its tiny parent. Moving it to be a direct child of `.screen` (which spans the whole route's content) fixed it - verified by scripting a scroll to the very bottom of the page and confirming the frame's bounding rect still matched the intended offset, not just eyeballing a mid-scroll screenshot.

The sticky offset (`top: calc(var(--header-h, 140px) + 10px)`) is measured in JS via a `ResizeObserver` on the header (`headerRef` + an effect keyed on `screen`), not a hardcoded pixel guess - the header's height isn't constant, since a long module title wraps to two lines on some screens and would either leave a gap or let the header cover the camera if the offset were a fixed constant. Capped at `max-width: 420px` so it doesn't balloon into a huge pinned block on a tablet-width screen (`.screen-stack` goes up to 760px).

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
- **earth-scale**: cutaway globe (R=1.75), shells, faces, ghost wireframe, chips; tapping opens a magnified surface slab (rock textures, brackets, "Mantle to 2,891 km" with a fading orange mantle block) plus a small clone of the same globe with a red marker, line and "Zoomed in here" label. The missing wedge is centered off-camera (`wedgeCenter = PI * 0.3`, not `PI/2`) so the sphere reads as mostly intact with the cutaway visible at an angle - centering it on the camera used to point the wedge opening straight at the viewer, which showed almost nothing but the two flat interior cut faces and read as a flat heart/apple shape with no sense of "this is a globe." Confirmed by screenshotting both wrong and fixed framings side by side, not by eyeballing the code. The mini-globe thumbnail (surface-detail view) sat with no backing of its own, right on top of the "Lithosphere"/"Asthenosphere" bracket labels (wider text sprites than expected, reaching past x=2.5) - read as a loose sticker rather than a grounded part of the scene. Gave it a two-circle "badge" (darker ring behind a light fill - the cheapest way to fake a bordered card with flat 3D geometry) and moved it clear of both those labels and the always-visible top caption; its visibility toggle (`a`-gated, same as `mini`/`zoomLine`/`zoomLabel`) was missed on the first pass and showed as a stray empty circle in the full-scale globe view - caught by screenshotting that view too, not assumed fixed.
- **replication**: real twisting double helix (instanced rungs/joints/links, letter sprites). "Separate and copy" unzips it from the left; a new strand (orange backbone) builds on each old one (blue), so both daughters visibly keep one old strand (semiconservative). Student choices from the workbench (`lab.basePairs`) colour the new bases (grey `?` = unset, red = wrong). Gestures: pull the helix apart (or tap it) to separate/rejoin; when separated, drag an A/T/C/G token from the tray onto a new-strand slot (a glow shows the target; a wrong base turns red and can be replaced), tap a placed base to take it back.
- **mutation**: two helices sharing one x scale (original above, edited below) with codon bands and a protein bead chain under each (edited beads turn orange where the amino acid changed, red for STOP). Each original base keeps its own piece, so an insertion or deletion slides every later base along and the codons regroup; the removed base lifts out, the changed/added base glows. Tap a base, or slide a finger along the original row, to pick `Base position` (caret marks it); tap the chip under the scene to cycle the mutation type.

### `ScienceScene.tsx`
Three.js 0.164.1 + AR.js scene. Studio environment lighting + ACES tone mapping. Generic pointer input: pointer raycast to the scene's table plane, `touch-action: pan-y` plus a touchmove `preventDefault` only while grabbing (so scrolling still works, and dragging is not cancelled by scroll on phones), relative pull from the grab point. A tap that misses every part falls back to the nearest target whose screen footprint is under 44 CSS px, grown to 44 px (`nearestSmall`): on a phone a battery cell or lever projects to about 7 px and was nearly impossible to hit (found 2026-10-09 by adb taps on the Redmi A3). Camera framing (`sceneBounds`, `frameScene`) fits measured bounds over sampled times and both extremes of control A. `viewMode "fallback"` (3D mode) uses a LIGHT background (`.ar-frame.fallback-mode`).

### Quality levels (0-3) and diagnostics
Auto step-down when fps stays under 19, persisted in `localStorage` as `tuklas-quality-v2`:
- 0 full; 1 marker detection every 2nd frame; 2 pixelRatio 1 + 320x240 tracking canvas (`trackingSize`, `trackingLow` state); 3 Lambert (cheaper) shading.

URL parameters: `?fps=1` (HUD: `render N fps | qN dN tNNN[ empty] | bNN`), `?q=<0-3>` force a level, `?detect=<n>` detect every n frames, `?empty=1` empty scene (isolates tracking cost). The HUD build label (currently `b40`, a string in `ScienceScene.tsx`) is how you confirm a phone loaded the new build; bump it on every change you want to verify remotely.

### Hand tracking (removed, 2026-10-08)
Was an experimental MediaPipe Hand Landmarker spike (`lib/handTracking.ts`, `?hands=1|cpu`), **not viable on budget phones**: Poco C65 GPU 5-10 fps render and 160-330 ms per detection; CPU worse (1-3 fps while tracking). Touch manipulation is the only interaction now. Removed `lib/handTracking.ts`, the 31 MB `frontend/public/mediapipe/` model files, and the `@mediapipe/tasks-vision` dependency; the fps HUD lost its `hands N fps | N ms DELEGATE | state` segment accordingly.

### Measured performance
- Marker tracking (AR.js) is the frame-rate ceiling on weak phones, not rendering.
- Redmi A3: about 10 fps at 640x480 every frame; about 20 with every-2nd-frame; after quality tuning all scenes 17-21 fps. With 320x240 tracking (`?q=2`, readout `q2 d2 t320`), 1.1 Inertia with the marker steady: 22-25 fps, mean 23.7 over 30 s (b38, 2026-10-09, phone charging at 32-38 C). About the 24 fps target, not consistently above it.
- Poco C65: 22-25 fps at room temperature (older build). Cold phones behave differently; test at room temperature. Re-measured 2026-10-09 on b40, 1.1 Inertia, marker steady, 30 s at 2 s samples, battery 12% and charging at 37-38 C: `q2` 50-60 fps (mean 54.9); `q0` 17-40 fps (mean 29.3), sliding from about 36 to about 20 as it warmed, so likely throttled - re-test q0 on a charged, cool phone before quoting it. Earth 2.2 and circuit gestures also passed on it.
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
