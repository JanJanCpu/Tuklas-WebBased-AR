# Graph Report - Tuklas-WebBased-AR  (2026-10-07)

## Corpus Check
- 83 files · ~154,125 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 2, .wasm 2, .example 1)

## Summary
- 1094 nodes · 1615 edges · 102 communities (42 shown, 60 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.84)
- Token cost: 0 input · 535,657 output

## Community Hubs (Navigation)
- MediaPipe WASM Core (internal)
- MediaPipe WASM Core (nosimd)
- Main React App Shell
- AR Scene & Experiment Controls
- Neon AI Gateway Skill Docs
- Frontend Dependencies
- Offline Record Storage
- Neon CLI Config
- Build Tooling Checks
- Backend Auth & Validation
- Frontend TypeScript Config
- Project Guidance Docs (CLAUDE.md)
- WASM Memory & Exceptions (A)
- WASM Memory & Exceptions (B)
- Module Data & Legacy Modules
- WASM Lazy File Streaming
- Backend Dependencies
- JWT Auth Library
- WASM Exception Info (A)
- WASM Exception Info (B)
- Backend TypeScript Config
- NPM Build Scripts
- AR.js Type Definitions
- Backend Runtime Dependencies
- Backend Dev Dependencies
- Express App Routers
- Express Server Bootstrap
- WebGPU Bind Group Entries (A)
- WebGPU Bind Group Entries (B)
- Emscripten Runtime Init (A)
- Emscripten Runtime Lifecycle (A)
- WebGPU Blend/Color State (A)
- WebGPU Vertex State (A)
- Emscripten Runtime Init (B)
- Emscripten Runtime Lifecycle (B)
- WebGPU Blend/Color State (B)
- WebGPU Vertex State (B)
- Vercel Backend Entry Point
- Vercel Deployment Config
- Canvas Fullscreen Handling (A)
- Emscripten TTY Syscalls (A)
- WebGPU Render Pass Attachments (A)
- Canvas Fullscreen Handling (B)
- Emscripten TTY Syscalls (B)
- WebGPU Render Pass Attachments (B)
- Emscripten File Sync (A)
- Emscripten FS Callback (A)
- Emscripten File Sync (B)
- Emscripten FS Callback (B)
- Service Worker Precache
- AR Printable Marker Asset
- Emscripten FS Close (A)
- Emscripten Async Callback (A)
- Emscripten Debug Hooks (A)
- Emscripten Exception Handling Types (A)
- Emscripten Exit Status (A)
- Emscripten Type Marshaling (A)
- Emscripten Char IO (A)
- Emscripten Path Lookup (A)
- WebGPU Depth/Stencil State (A)
- Emscripten Type Registration (A)
- Emscripten Filesystem Stats (A)
- Emscripten FS Close (B)
- Emscripten Async Callback (B)
- Emscripten Debug Hooks (B)
- Emscripten Exception Handling Types (B)
- Emscripten Exit Status (B)
- Emscripten Type Marshaling (B)
- Emscripten Char IO (B)
- Emscripten Path Lookup (B)
- WebGPU Depth/Stencil State (B)
- Emscripten Type Registration (B)
- Emscripten Filesystem Stats (B)
- AR.js Type Defs (three.js build)
- AR.js Module Type Defs
- App Icon 180px
- App Icon 192px
- App Icon 32px
- App Icon 512px
- Camera Media Access (A)
- Emscripten ioctl Syscall (A)
- Emscripten File Seek (A)
- Emscripten FS Lookup (A)
- Emscripten mknod Syscall (A)
- Emscripten Mount Syscall (A)
- Emscripten readdir Syscall (A)
- Emscripten rename Syscall (A)
- Emscripten rmdir Syscall (A)
- Emscripten symlink Syscall (A)
- Emscripten unlink Syscall (A)
- Camera Media Access (B)
- Emscripten ioctl Syscall (B)
- Emscripten File Seek (B)
- Emscripten FS Lookup (B)
- Emscripten mknod Syscall (B)
- Emscripten Mount Syscall (B)
- Emscripten readdir Syscall (B)
- Emscripten rename Syscall (B)
- Emscripten rmdir Syscall (B)
- Emscripten symlink Syscall (B)
- Emscripten unlink Syscall (B)

## God Nodes (most connected - your core abstractions)
1. `Workspace()` - 50 edges
2. `request()` - 17 edges
3. `compilerOptions` - 16 edges
4. `ExceptionInfo` - 13 edges
5. `ExceptionInfo` - 13 edges
6. `scripts` - 11 edges
7. `showToast()` - 11 edges
8. `createExperimentScene()` - 11 edges
9. `scripts` - 11 edges
10. `compilerOptions` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Three-piece deployment topology (frontend/backend/Neon DB)` --semantically_similar_to--> `Lakebase Postgres Skill`  [INFERRED] [semantically similar]
  CLAUDE.md → .claude/skills/neon-postgres/SKILL.md
- `Twelve-experiment POE module catalog (Q1-Q4)` --shares_data_with--> `Dynamic AR system (feature/dynamic-ar)`  [INFERRED]
  docs/experiment-validation.md → CLAUDE.md
- `Tuklas frontend index.html entry point` --shares_data_with--> `Dynamic AR system (feature/dynamic-ar)`  [INFERRED]
  frontend/index.html → CLAUDE.md
- `post()` --calls--> `signToken()`  [EXTRACTED]
  scripts/test-sync.mjs → backend/src/lib/auth.ts
- `Mastra Agents with Mastra Studio Observability (reference)` --semantically_similar_to--> `Sentry Error Monitoring on Neon Functions (reference)`  [INFERRED] [semantically similar]
  .claude/skills/neon-functions/references/mastra-studio.md → .claude/skills/neon-functions/references/sentry.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Neon Agent Skill Family (parent + child skills)** — claude_skills_neon_skill, claude_skills_neon_ai_gateway_skill, claude_skills_neon_functions_skill, claude_skills_neon_object_storage_skill, claude_skills_neon_postgres_skill, claude_skills_neon_postgres_branches_skill, claude_skills_neon_postgres_egress_optimizer_skill [EXTRACTED 1.00]
- **Lakebase Search feature group (vector, full-text, hybrid)** — claude_skills_neon_postgres_skill_lakebase_search, claude_skills_neon_postgres_references_vector_search, claude_skills_neon_postgres_references_full_text_search, claude_skills_neon_postgres_references_hybrid_search [EXTRACTED 1.00]
- **Neon Functions integration reference docs (AI SDK, Mastra, MCP, Sentry, SSE)** — claude_skills_neon_functions_skill, claude_skills_neon_functions_references_ai_sdk, claude_skills_neon_functions_references_mastra_studio, claude_skills_neon_functions_references_mcp, claude_skills_neon_functions_references_sentry, claude_skills_neon_functions_references_sse [EXTRACTED 1.00]

## Communities (102 total, 60 thin omitted)

### Community 2 - "Main React App Shell"
Cohesion: 0.06
Nodes (69): App(), BeforeInstallPromptEvent, ExperimentTrial, ModuleIcon(), moduleIcons, REQUIRED_STAGES, ScienceScene, stagesFor() (+61 more)

### Community 3 - "AR Scene & Experiment Controls"
Cohesion: 0.07
Nodes (34): setActiveModule(), ExperimentControls(), createExperimentScene(), Finish, Interaction, InteractionApi, ScienceScene(), startHands() (+26 more)

### Community 4 - "Neon AI Gateway Skill Docs"
Cohesion: 0.07
Nodes (30): Neon AI Gateway Skill, @neon/ai-sdk-provider, Neon AI Gateway (one API, one credential, multi-model), /v1/models live model catalog endpoint, AI SDK Agents on Neon Functions (reference), Mastra Agents with Mastra Studio Observability (reference), MCP Servers on Neon Functions (reference), MCP streamable HTTP transport over fetch handler (+22 more)

### Community 5 - "Frontend Dependencies"
Cohesion: 0.06
Nodes (32): dependencies, @ar-js-org/ar.js, lucide-react, @mediapipe/tasks-vision, react, react-dom, three, vite (+24 more)

### Community 6 - "Offline Record Storage"
Cohesion: 0.08
Nodes (30): createRecordSession(), Change, clearRecords(), fallbackRecords(), loadRecords(), openDb(), saveRecord(), updateRecords() (+22 more)

### Community 7 - "Neon CLI Config"
Cohesion: 0.08
Nodes (23): dependencies, @neon/config, @neon/env, description, engines, node, name, private (+15 more)

### Community 8 - "Build Tooling Checks"
Cohesion: 0.11
Nodes (17): card(), click(), errors, evaluate(), page, pages, pending, range() (+9 more)

### Community 9 - "Backend Auth & Validation"
Cohesion: 0.15
Nodes (13): hasDatabaseUrl(), passwordSchema, usernameSchema, accountRelations, loginSchema, registerTeacherSchema, requireDatabase(), resetProgressSchema (+5 more)

### Community 10 - "Frontend TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 11 - "Project Guidance Docs (CLAUDE.md)"
Cohesion: 0.13
Nodes (13): Tuklas API placeholder page, CLAUDE.md Project Guidance, Three-piece deployment topology (frontend/backend/Neon DB), Dynamic AR system (feature/dynamic-ar), Offline-first sync model (ActivityRecord as source of truth), Quality levels 0-3 and AR diagnostics, Tuklas AR Science Lab (capstone project), Grade 9 experiment catalog and validation doc (+5 more)

### Community 12 - "WASM Memory & Exceptions (A)"
Cohesion: 0.12
Nodes (17): abort(), assert(), assignWasmExports(), createWasm(), receiveInstance(), receiveInstantiationResult(), findWasmBinary(), forceLoadFile() (+9 more)

### Community 13 - "WASM Memory & Exceptions (B)"
Cohesion: 0.12
Nodes (17): abort(), assert(), assignWasmExports(), createWasm(), receiveInstance(), receiveInstantiationResult(), findWasmBinary(), forceLoadFile() (+9 more)

### Community 14 - "Module Data & Legacy Modules"
Cohesion: 0.23
Nodes (9): legacyModules, modules, toPersistedModule(), requireRole(), prisma, recordSchema, syncRouter, syncSchema (+1 more)

### Community 15 - "WASM Lazy File Streaming"
Cohesion: 0.21
Nodes (11): createLazyFile(), stream_ops, writeChunks(), mmap(), position(), createLazyFile(), stream_ops, writeChunks() (+3 more)

### Community 16 - "Backend Dependencies"
Cohesion: 0.14
Nodes (13): typescript, name, private, type, version, prisma, tsx, @types/bcryptjs (+5 more)

### Community 17 - "JWT Auth Library"
Cohesion: 0.19
Nodes (12): AuthTokenPayload, Express, getJwtSecret(), hashPassword(), readBearerToken(), Request, requireAuth(), signToken() (+4 more)

### Community 20 - "Backend TypeScript Config"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+3 more)

### Community 21 - "NPM Build Scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:generate, db:migrate, db:migrate:deploy, db:studio, dev, postinstall (+3 more)

### Community 22 - "AR.js Type Definitions"
Cohesion: 0.18
Nodes (3): ArToolkitContext, ArToolkitSource, Window

### Community 23 - "Backend Runtime Dependencies"
Cohesion: 0.20
Nodes (10): dependencies, bcryptjs, cors, dotenv, express, helmet, jsonwebtoken, morgan (+2 more)

### Community 24 - "Backend Dev Dependencies"
Cohesion: 0.20
Nodes (10): devDependencies, prisma, tsx, @types/bcryptjs, @types/cors, @types/express, @types/jsonwebtoken, @types/morgan (+2 more)

### Community 25 - "Express App Routers"
Cohesion: 0.24
Nodes (8): authRouter, healthRouter, modulesRouter, sectionsRouter, cors, express, helmet, morgan

### Community 26 - "Express Server Bootstrap"
Cohesion: 0.29
Nodes (5): createApp(), app, port, server, dotenv

### Community 27 - "WebGPU Bind Group Entries (A)"
Cohesion: 0.33
Nodes (6): makeBufferEntry(), makeEntries(), makeEntry(), makeSamplerEntry(), makeStorageTextureEntry(), makeTextureEntry()

### Community 28 - "WebGPU Bind Group Entries (B)"
Cohesion: 0.33
Nodes (6): makeBufferEntry(), makeEntries(), makeEntry(), makeSamplerEntry(), makeStorageTextureEntry(), makeTextureEntry()

### Community 30 - "Emscripten Runtime Lifecycle (A)"
Cohesion: 0.40
Nodes (5): initRuntime(), postRun(), preRun(), run(), doRun()

### Community 31 - "WebGPU Blend/Color State (A)"
Cohesion: 0.40
Nodes (5): makeBlendComponent(), makeBlendState(), makeColorState(), makeColorStates(), makeFragmentState()

### Community 32 - "WebGPU Vertex State (A)"
Cohesion: 0.40
Nodes (5): makeVertexAttribute(), makeVertexAttributes(), makeVertexBuffer(), makeVertexBuffers(), makeVertexState()

### Community 34 - "Emscripten Runtime Lifecycle (B)"
Cohesion: 0.40
Nodes (5): initRuntime(), postRun(), preRun(), run(), doRun()

### Community 35 - "WebGPU Blend/Color State (B)"
Cohesion: 0.40
Nodes (5): makeBlendComponent(), makeBlendState(), makeColorState(), makeColorStates(), makeFragmentState()

### Community 36 - "WebGPU Vertex State (B)"
Cohesion: 0.40
Nodes (5): makeVertexAttribute(), makeVertexAttributes(), makeVertexBuffer(), makeVertexBuffers(), makeVertexState()

### Community 38 - "Vercel Deployment Config"
Cohesion: 0.50
Nodes (3): framework, rewrites, $schema

### Community 39 - "Canvas Fullscreen Handling (A)"
Cohesion: 0.50
Nodes (4): getFullscreenElement(), requestFullscreen(), fullscreenChange(), updateCanvasDimensions()

### Community 40 - "Emscripten TTY Syscalls (A)"
Cohesion: 0.50
Nodes (4): ioctl_tcgets(), ioctl_tcsets(), ioctl_tiocgwinsz(), ___syscall_ioctl()

### Community 41 - "WebGPU Render Pass Attachments (A)"
Cohesion: 0.50
Nodes (4): makeColorAttachment(), makeColorAttachments(), makeDepthStencilAttachment(), makeRenderPassDescriptor()

### Community 42 - "Canvas Fullscreen Handling (B)"
Cohesion: 0.50
Nodes (4): getFullscreenElement(), requestFullscreen(), fullscreenChange(), updateCanvasDimensions()

### Community 43 - "Emscripten TTY Syscalls (B)"
Cohesion: 0.50
Nodes (4): ioctl_tcgets(), ioctl_tcsets(), ioctl_tiocgwinsz(), ___syscall_ioctl()

### Community 44 - "WebGPU Render Pass Attachments (B)"
Cohesion: 0.50
Nodes (4): makeColorAttachment(), makeColorAttachments(), makeDepthStencilAttachment(), makeRenderPassDescriptor()

### Community 45 - "Emscripten File Sync (A)"
Cohesion: 0.67
Nodes (3): msync(), put_char(), write()

### Community 46 - "Emscripten FS Callback (A)"
Cohesion: 1.00
Nodes (3): syncfs(), doCallback(), done()

### Community 47 - "Emscripten File Sync (B)"
Cohesion: 0.67
Nodes (3): msync(), put_char(), write()

### Community 48 - "Emscripten FS Callback (B)"
Cohesion: 1.00
Nodes (3): syncfs(), doCallback(), done()

## Knowledge Gaps
- **199 isolated node(s):** `app`, `name`, `version`, `private`, `type` (+194 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 643 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **60 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `modules` connect `Module Data & Legacy Modules` to `Build Tooling Checks`, `Main React App Shell`, `AR Scene & Experiment Controls`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Workspace()` (e.g. with `fetchMyRecords()` and `syncRecords()`) actually correct?**
  _`Workspace()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `app`, `name`, `version` to the rest of the system?**
  _199 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MediaPipe WASM Core (internal)` be split into smaller, more focused modules?**
  _Cohesion score 0.010752688172043012 - nodes in this community are weakly interconnected._
- **Why does `length()` connect `WASM Lazy File Streaming` to `Offline Record Storage`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `MediaPipe WASM Core (nosimd)` be split into smaller, more focused modules?**
  _Cohesion score 0.010810810810810811 - nodes in this community are weakly interconnected._
- **Why does `@prisma/client` connect `Module Data & Legacy Modules` to `Backend Dependencies`, `Backend Auth & Validation`, `Offline Record Storage`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._