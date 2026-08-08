# Talking Head 2 — Milestone Plan

Executable breakdown aligned with [CONTEXT.md](./CONTEXT.md). Stack: T3 (Next.js Pages Router, tRPC, Drizzle, Auth.js), S3 + CloudFront, Vercel Workflows, Remotion Player + Lambda, Replicate WhisperX.

**Repos:** `/Users/aaron/Documents/projects/talking-head-2`  
**Prototype:** `/Users/aaron/Documents/projects/talking-head` (sibling). Prototype paths below are relative to that repo unless noted. Prefer listed files as copy sources; adapt names/shapes to CONTEXT — **no dual-read** of prototype YAML / string edit ids / Cut lists.

Agents working a milestone: read **CONTEXT.md** + this milestone’s **Agent brief** + **Contracts** before coding. Do not start later milestones. Do not commit unless asked.

---

## Status (keep updated)

| Milestone | Status | Notes |
|-----------|--------|--------|
| M1 Landing + login | **Done** | Google Auth.js, landing `/`, SSR gates in `src/server/auth/session.ts` |
| M2 Projects page | **Done** | `projects` table, `project.list` / `byId`, grid + create modal shell |
| M3 Create pipeline | **Done** | Presign upload → WhisperX → keeps → AI seed; `withWorkflow` always on; create uses in-process unless `USE_VERCEL_WORKFLOW=true` (set on Vercel for prod) |
| M4 Editor | **Done** | Shell: Assets\|Transcript\|Player\|Timeline; arolls delete+ripple; Zustand+autosave; Remotion preview (A-roll stitch, captions, zoom, title text). Caption/text chrome simplified vs full catalog; no Lambda export (M4b). |
| M4b Export Lambda | Not started | |
| M5 Features | In progress | **5.1–5.2 done** — captions stack+inspector; text VFX templates/inspector/place + independent title rename; next 5.3 B-roll |

### Already in talking-head-2 (do not re-scaffold)

- Auth + projects UI: `src/pages/{index,projects/index,projects/[id]}.tsx`, `CreateProjectModal.tsx`, `ProjectCard.tsx`, `AppLayout` / `Navbar`
- Schema: auth + `projects` + `assets` + `transcripts` (`src/server/db/schema.ts`)
- tRPC: `project.list` / `byId` / `createStart` / `createFinalize` / `updateConfig` / `updateTranscriptWords`
- Media infra live (`infra/`); AWS/OpenAI/Replicate/CF wired in `src/env.js`
- Create: modal uploads via S3 presign; pipeline in `src/server/create/`; Workflow module at `src/workflows/create-project.ts` (`withWorkflow` in `next.config.js`; gate with `USE_VERCEL_WORKFLOW`)
- Editor: `src/editor/` (Zustand + panels); Remotion preview in `src/remotion/`; domain Model in `src/domain/{arolls,edits,keeps,projection,project-config}.ts`
- shadcn (base-nova) + brand tokens; prefer type-only imports (`eslint` / `.vscode`)

---

## Prototype → production (naming & shape)

| Prototype | Production (this repo) |
|-----------|-------------------------|
| Episode / `episodeId` / `source/<id>/` | **Project** / Postgres row + S3 keys |
| EpisodeConfig (YAML) | **ProjectConfig** (JSONB on Project) |
| EpisodeProps | **ProjectProps** |
| `title` in config + on-screen text VFX | `Project.title` DB column; on-screen title = `vfx/text` Edit (seed once) |
| `captionTemplateId` + `captionStyle` | **TemplateStyle** `{ templateId, overrides? }` as Project field `captions` |
| Persisted **Cut** delete ranges; keeps derived | Persisted **ArollKeep[]**; gaps derived in View |
| Parallel arrays (`bRolls`, `vfx`, `sfx`, `punchInSegments`) | Flat **`edits[]`** + `kind` |
| `punchIn` / punch-in segments | **`zoom`** Edit |
| `emphasis: "positive" \| "negative"` | `emphasized?: boolean` on transcript words |
| String clip ids | Monotonic int **EditId** |
| Edits in **source** (local) time; map→output at props | Edits in **global** time; arolls/transcript words local |
| Single A-roll file per episode | Multi-asset **`arolls`** stitch order |
| `public/` hardlink/symlink for Remotion | Private **S3** + CloudFront signed URLs (`infra/`) |
| No product auth; FS episode picker | Auth.js Google; `/projects` grid |
| Local Remotion `renderMedia` | Remotion **Lambda** + export workflow |

**Ripple:** Prototype keeps edits in source time, so cut surgery does not shift edit timestamps. Here edits are global → after arolls surgery, clamp/remove overlaps then ±shift later edits (new Model behavior; no direct prototype equivalent).

---

## Milestone 1 — Landing + login

**Goal:** Bare landing page with Google login; unauthenticated users cannot reach app routes.

### Prototype

No product auth. Closest chrome only:

- `editor/src/components/Navbar.tsx` — header patterns (different product surface)
- Episode picker is local FS (`editor/src/components/EpisodePicker.tsx`, `editor/server/episodes.ts`) — **not** a copy source for auth

### Steps

1. Confirm Auth.js Google provider + Drizzle adapter env (`AUTH_SECRET`, Google client IDs) in `src/env.js`.
2. Replace default T3 scaffold home with a minimal landing: brand/name, short line, **Log in** → Google.
3. Add auth gate: signed-in users redirect to `/projects` (stub OK); protect `/projects` and later `/projects/[id]` via session check (middleware or layout).
4. Sign-out control (landing or stub projects header).
5. Remove or ignore example `posts` demo routes from the happy path (can delete in M2 with schema work).

**Done when:** Cold visit → landing → Google → session cookie → redirected to `/projects` (even if empty stub).

---

## Milestone 2 — Projects page

**Goal:** Grid of the user’s projects + entry point to create (create modal can be stub that navigates or no-ops until M3).

### Prototype

- `editor/src/components/EpisodePicker.tsx` + `editor/server/episodes.ts` — list “episodes” from disk (concept only: pick → open editor)
- Dropzone UX: `editor/src/components/ui/dropzone.tsx`; import batch UX under Assets

**Differences:** Postgres-owned projects + status chips; no FS scan. Create modal is new (already stubbed in this repo).

### Steps

1. Drizzle schema — `Project` table:
   - `id`, `userId`, `title` (nullable until AI/user sets), `status`, `failureReason`, `config` (jsonb, default empty/`null` until M3), `configUpdatedAt`, `exportS3Key`, `createdAt`, `updatedAt`
   - Status enum: `processing | ready | exporting | failed`
2. Drop or stop using scaffold `posts` table if unused.
3. tRPC `project.list` — `where userId = session.user.id`, order by `updatedAt` desc.
4. `/projects` page: title **Projects**, responsive 3-col card grid (wireframe), empty state.
5. Card shows title (or “Untitled”), status chip, updated time; click → `/projects/[id]` only if `ready` (or processing detail stub).
6. **New project** button opens modal shell (drop zone UI OK without upload wiring).
7. Authorize: all project procedures enforce owner `userId`.

**Done when:** Logged-in user sees their projects grid; create modal opens; no cross-user leakage.

---

## Milestone 3 — Create project (S3 + WhisperX + AI seed)

**Goal:** Drag 1..n A-roll videos → upload → workflow → `ready` project with transcripts, `arolls`, captions, title text VFX, zooms, emphasis.

### Agent brief (M3)

**Mission:** Implement end-to-end create so the existing Create modal uploads videos to S3 and a background workflow leaves a `ready` Project (or `failed` + reason). Stay inside M3 — no editor Remotion shell (M4).

**Read first:** `CONTEXT.md` (Language + Pipelines + Status), this M3 section, then prototype files in the table below.

**Constraints:**
- Match existing code style (T3, tRPC protectedProcedure, Drizzle `createTable` prefix `talking-head-2_`).
- Prefer type-only imports.
- Do not commit; do not push; do not print secrets from `.env`.
- Do not port listicle/cutout/music/schedule.
- If Vercel Workflows cannot run locally without `vercel link`, still implement the workflow module + a **dev fallback** that runs the same step functions in-process from `createFinalize` (feature-flagged or `NODE_ENV===development`), so create works on laptop. Document how to enable real Workflows.
- Apply schema with `drizzle-kit push` (or raw SQL if push hangs on interactive prompts — prior session used SQL for that reason).
- Run `npm run typecheck` (and fix) before finishing.

**Out of scope for M3:** editor UI, Remotion player, export Lambda, global SFX seed, CloudFront signed GET usage in UI (helpers OK to implement for later).

### Prototype sources

| Concern | Absolute path under prototype | Notes |
|---------|------------------------------|--------|
| Orchestration order | `…/talking-head/cli/process.ts` | Step order reference |
| Keep builder | `…/talking-head/cli/helpers/cuts.ts` | Invert → `ArollKeep[]` |
| Gap / timing constants | `…/talking-head/src/lib/timeline/editing-constants.ts`, `…/cli/helpers/constants.ts` | Long-gap only (no filler cuts); `DEFAULT_TEXT_VFX_DURATION_SEC = 5` |
| Timeline math | `…/talking-head/src/lib/timeline/source-timeline.ts` | Projection / keep inversion |
| Transcript types | `…/talking-head/src/lib/episode/transcript-types.ts` | Drop pos/neg |
| Config / edit shapes | `…/talking-head/src/lib/episode/config-types.ts` | Reshape to flat edits |
| AI title | `…/talking-head/cli/modules/title.ts` | Port prompts + zod schema; `gpt-4.1-mini` |
| AI zooms | `…/talking-head/cli/modules/punchin.ts` | → `zoom` edits, **global** times |
| AI emphasis | `…/talking-head/cli/modules/emphasis.ts` | → `emphasized: true` only |
| Title VFX seed | `…/talking-head/cli/helpers/config.ts` (`ensureDefaultTextVfx`) | |
| Defaults | `…/talking-head/config.default.yaml` | `captionTemplateId: hormozi` |
| Caption template id | `…/talking-head/src/lib/captions/templates.ts` | `DEFAULT_CAPTION_TEMPLATE_ID = "hormozi"` |
| Whisper (shape only) | `…/talking-head/cli/helpers/whisper.ts` | Use Replicate WhisperX instead |
| **Do not port** | `cli/helpers/link-public.ts`, whispermlx runner as runtime | S3/CF already exist |

### Differences vs prototype process

- Multi A-roll → concatenated `arolls` by upload order.
- Persist **keeps**, not cuts; Postgres + S3, not YAML/`public/`.
- Replicate `victor-upmeet/whisperx` (language autodetect, **diarization off**).
- AI always-on for create (ignore prototype process flags).
- Edits use **global** timestamps after stitch; keep builder runs **per asset** in local time, then concatenate keeps in asset order (each keep carries `assetId`).

### Target files (create / touch in talking-head-2)

Suggested layout (adjust if cleaner, keep MVC boundaries):

```
src/env.js                          # add AWS/OpenAI/Replicate/CF vars
src/server/db/schema.ts             # assets, transcripts (+ relations)
src/domain/project-config.ts        # Zod/TS: ProjectConfig, ArollKeep, Edit, TemplateStyle
src/domain/transcript.ts            # word type + emphasized
src/domain/keeps.ts                 # buildArollKeepsFromWords (port/invert cuts.ts)
src/domain/projection.ts            # global words from arolls + transcripts (for AI)
src/server/media/s3.ts              # S3 client, presign PUT, HeadObject
src/server/media/keys.ts            # key layout helpers
src/server/media/cloudfront.ts      # signed GET helper (optional for M3 UI)
src/server/ai/title.ts              # port title module
src/server/ai/zooms.ts              # port punchin → zoom
src/server/ai/emphasis.ts           # port emphasis → boolean
src/server/ai/openai.ts             # shared client
src/server/transcribe/whisperx.ts   # Replicate client + normalize words
src/server/api/routers/project.ts   # createStart, createFinalize; enrich byId/list
src/workflows/create-project.ts     # Vercel Workflow definition (or workflows/)
src/pages/api/...                   # workflow route handlers if required by SDK
src/components/projects/CreateProjectModal.tsx  # wire upload
src/pages/projects/index.tsx        # poll processing projects
```

### Contracts

#### Env (`src/env.js` server)

| Var | Required | Notes |
|-----|----------|--------|
| `AWS_REGION` | yes | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | yes | |
| `AWS_SECRET_ACCESS_KEY` | yes | |
| `AWS_S3_BUCKET` | yes | from CDK output |
| `CLOUDFRONT_DOMAIN` | yes | no `https://` |
| `CLOUDFRONT_KEY_PAIR_ID` | yes | |
| `CLOUDFRONT_PRIVATE_KEY` | yes | PEM; may contain `\n` escapes — unescape when loading |
| `OPENAI_API_KEY` | yes | |
| `REPLICATE_API_TOKEN` | yes | |

#### Schema

**`assets`** (`talking-head-2_asset`):

| Column | Type | Notes |
|--------|------|--------|
| `id` | varchar PK uuid | |
| `projectId` | varchar nullable FK → projects | null = global (unused in M3) |
| `kind` | varchar | `video` \| `image` \| `audio` |
| `s3Key` | varchar | |
| `contentType` | varchar | |
| `durationSec` | double precision nullable | filled after probe/Whisper |
| `originalFilename` | varchar nullable | |
| `sortOrder` | integer | upload order for A-roll stitch (0..n-1) |
| `createdAt` / `updatedAt` | timestamptz | |

**`transcripts`** (`talking-head-2_transcript`):

| Column | Type | Notes |
|--------|------|--------|
| `id` | varchar PK uuid | |
| `assetId` | varchar unique FK → assets | 1:1 |
| `words` | jsonb | `TranscriptWord[]` |
| `durationSec` | double precision nullable | |
| `language` | varchar nullable | |
| `status` | varchar | `pending` \| `ready` \| `failed` |
| `raw` | jsonb nullable | optional Replicate payload slice |
| `createdAt` / `updatedAt` | timestamptz | |

**`TranscriptWord`:** `{ text: string, start: number, end: number, emphasized?: boolean }` — local asset time.

**S3 key layout:** `projects/{projectId}/assets/{assetId}/source` (extension optional; store contentType on row).

#### Domain types (minimal for M3)

```ts
type TemplateStyle = { templateId: string; overrides?: Record<string, unknown> };
type ArollKeep = { assetId: string; start: number; end: number }; // local sec
type EditId = number;
type ZoomEdit = { id: EditId; kind: "zoom"; start: number; end: number; scale?: number };
type VfxTextEdit = {
  id: EditId; kind: "vfx"; type: "text"; start: number; end: number;
  text: string; style?: TemplateStyle;
};
// M3 may only seed zoom + vfx/text; still type the union for later:
// broll | sfx | zoom | vfx (quote|text)
type ProjectConfig = {
  arolls: ArollKeep[];
  edits: Edit[];
  captions: TemplateStyle;
};
```

Empty → after create: `arolls` filled, `edits` may include zooms + one text VFX, `captions: { templateId: "hormozi" }`.

Title VFX seed: `start: 0`, `end: min(5, globalDuration)` (use `DEFAULT_TEXT_VFX_DURATION_SEC`), `text` = project title string, assign next EditId.

#### tRPC

**`project.createStart`**
- Input: `{ title?: string; files: { filename: string; contentType: string; size: number }[] }`
- Validate: session; `files.length >= 1`; each `contentType` starts with `video/`
- Create Project `status=processing`, `title` optional, `config={}`
- Create Asset rows (`kind=video`, `sortOrder=index`, `s3Key` assigned)
- Return: `{ projectId, uploads: { assetId, s3Key, uploadUrl, contentType }[] }`
- `uploadUrl`: S3 presigned PUT, TTL ~1h, include Content-Type header requirement matching

**`project.createFinalize`**
- Input: `{ projectId: string }`
- Authz: owner; status must be `processing`
- Verify each asset object exists in S3 (`HeadObject`); if missing → `failed` + reason or throw
- Start create workflow (or dev in-process runner)
- Return: `{ projectId, status: "processing" }`

**`project.byId` / `list`**
- Include `status`, `failureReason`, `title`, timestamps (already); ensure polling works for processing cards

#### Client (`CreateProjectModal`)

1. On Create: `createStart` with file metadata (+ optional title field if easy; else omit).
2. `PUT` each file to `uploadUrl` with `Content-Type` (parallel).
3. On all success: `createFinalize`.
4. Close modal; projects list should show new card as `processing`.
5. Errors: surface toast or inline error; leave project `failed` if finalize/workflow fails.

#### Workflow steps (deterministic order)

1. **Per asset** (serial or limited parallel): HeadObject → Replicate WhisperX → normalize words → upsert Transcript `ready` + set `asset.durationSec` from transcript/audio duration.
2. **Keeps:** For each asset in `sortOrder`, `buildArollKeepsFromWords({ words, durationSec, assetId })` → concat into `config.arolls`. If no speech, one full-span keep `[0, duration]`.
3. **Project** global word list via projection (for AI).
4. **AI title** if `project.title` null/empty → set column; seed `vfx/text` edit.
5. **AI zooms** → append `zoom` edits (global). If OpenAI fails, log and continue with empty zooms (do not fail whole project unless you prefer hard-fail — prefer soft-fail for AI, hard-fail for whisper).
6. **AI emphasis** → update transcript words’ `emphasized` (map global indices back to per-asset words). Soft-fail OK.
7. Set `config.captions = { templateId: "hormozi" }`, `configUpdatedAt=now()`, `status=ready`.
8. On hard failure: `status=failed`, `failureReason` string (truncate ~2k).

**WhisperX:** model `victor-upmeet/whisperx`; disable diarization; language auto. Normalize segments/words to `TranscriptWord[]`. Store minimal `raw` if useful for debug.

**Keep builder:** Port logic from `buildCutsFromWords` but **return keeps** with `assetId` (the function already builds keep intervals internally before converting to cuts — prefer emitting those keep intervals directly; see cuts.ts keepRaw/speechKeep path).

#### UI polling

- On `/projects`, while any listed project has `status===processing`, refetch list every ~2s (react-query `refetchInterval`).
- Failed: show failure chip / reason on card (truncate).
- Click: allow open stub `[id]` for `processing`/`failed` with status message; `ready` can stay stub until M4.

### Implementation slices (PR-sized; do in order)

1. **Types + schema + env + push** — `project-config`, transcript types, assets/transcripts tables, `env.js`, drizzle push.
2. **S3 helpers + createStart/createFinalize (without AI)** — finalize starts workflow stub that sets full-keep arolls + empty edits + captions + `ready` after fake/no transcript **OR** better: only HeadObject then mark ready with full-file keep and empty transcript skipped — prefer real whisper in slice 3.
3. **WhisperX + transcripts + keep builder** — real transcription; status ready with arolls from keeps; skip AI temporarily if needed then immediately:
4. **AI title/zooms/emphasis** — port modules; projection helper.
5. **Wire modal + polling** — end-to-end manual test path documented in agent final message.

### Acceptance (M3 done when)

- [ ] User can drop ≥1 video, Create, see `processing` then `ready` (or `failed` with reason).
- [ ] S3 contains source objects; Asset + Transcript rows exist; words non-empty for speech audio.
- [ ] `config.arolls` is non-empty `ArollKeep[]` with correct `assetId`s; multi-file order preserved.
- [ ] `config.captions.templateId === "hormozi"`.
- [ ] If title was empty, `project.title` set and a `vfx/text` edit exists (unless AI soft-failed — then note in final report).
- [ ] Zoom edits and/or emphasis present when AI succeeds.
- [ ] `npm run typecheck` passes.
- [ ] No secrets committed; `infra/keys/` untouched in git.

### Verification commands

```bash
cd /Users/aaron/Documents/projects/talking-head-2
npm run typecheck
# manual: npm run dev → login → New project → upload short mp4 → watch status
```

---

## Milestone 4 — Editor shell

**Goal:** `/projects/[id]` editor with Assets, Transcript, Player, Timeline — topology editing (keeps/ripple), selection, autosave. Remotion compositions exist for A-roll + captions baseline.

### Agent brief (M4)

**Mission:** Replace the stub `/projects/[id]` with a working editor shell for `ready` projects: load config/assets/transcripts + signed media URLs; Zustand controller with undo + debounced autosave; global transcript with delete→arolls surgery + ripple; timeline keep/gap + zoom/text cells; Remotion Player preview (A-roll stitch + captions + zooms + title text). Stay inside M4 — no Lambda export (M4b), no b-roll/sfx/quote feature polish beyond displaying create-seeded edits (M5).

**Read first:** `CONTEXT.md` (MVC, coordinates, ripple, composition matrix), this M4 section, existing domain types in `src/domain/`, create pipeline outputs in `src/server/create/run-create-pipeline.ts`.

**Constraints:**
- Prefer type-only imports; match T3 + existing shadcn theme.
- Do **not** mention the prototype in source comments (PLAN.md only).
- No filler-word cuts (already removed from keep builder).
- Edits use `EditBase` (`id`, global `start`/`end`) + `kind` discriminant.
- Do not commit; do not print secrets.
- `npm run typecheck` must pass.
- Update PLAN Status: M4 → Done (or Partially done with honest notes) when finished.

**Already in th2 (reuse):**
- Domain: `src/domain/{project-config,transcript,keeps,projection,editing-constants,project-status}.ts`
- Media: `src/server/media/{s3,cloudfront,keys}.ts` — use CloudFront signed GET for player URLs
- Stub page: `src/pages/projects/[id].tsx`
- Create seeds: `arolls`, `zoom` + `vfx/text` edits, `captions: { templateId: "hormozi" }`, transcript `emphasized`

**Target layout (suggested):**
```
src/domain/arolls.ts              # surgery + ripple (pure Model)
src/domain/edits.ts               # place/patch/remove stubs for zoom/vfx/text
src/remotion/                     # TalkingHead composition + props build + primitives
src/editor/store.ts               # Zustand controller
src/editor/selection-store.ts
src/editor/components/...         # Assets, Transcript, Timeline, Player panels
src/pages/projects/[id].tsx       # editor route shell
src/server/api/routers/project.ts # enrich byId; updateConfig; updateTranscriptWords
```

**tRPC contracts:**
- `project.byId` — return full project (config, configUpdatedAt, status), assets (with signed playback URL + duration), transcripts (words). Allow `ready` | `exporting` (exporting read-only OK). Reject/redirect `processing`/`failed` with status UI.
- `project.updateConfig` — input `{ id, config, configUpdatedAt }`; if client timestamp ≠ DB → conflict error; else write config + new `configUpdatedAt`.
- `project.updateTranscriptWords` — input `{ assetId, words }` (or project-scoped batch); owner check via asset.projectId.

**Implementation slices:**
1. Enrich `byId` + signed URLs; editor page loads data for `ready`.
2. Model: arolls delete-range + ripple; Zustand + autosave `updateConfig`.
3. Transcript panel (global projection, select, delete, emphasize toggle).
4. Timeline (A-roll keep/gap, zoom/text cells, playhead).
5. Remotion Player + `buildProjectProps` (A-roll + captions + zoom + text VFX).
6. Transcript chrome for zoom/text (markers/handles).

**Acceptance (M4 done when):**
- [ ] Open `ready` project → Assets | Transcript | Player | Timeline layout
- [ ] Scrub playhead; player shows stitched A-roll + captions
- [ ] Delete a speech range → arolls update, later edits ripple, autosave persists reload
- [ ] Toggle emphasis persists
- [ ] Create-seeded zooms + title text visible in transcript chrome and/or player
- [ ] `npm run typecheck` passes

### Prototype sources

| Concern | Copy from | Notes |
|---------|-----------|--------|
| Layout shell | `editor/src/App.tsx` | Assets \| Transcript \| Player + Timeline |
| Controller / undo / autosave | `editor/src/store.ts` | ~400ms debounce → replace PUT YAML with tRPC `updateConfig` |
| Selection | `editor/src/selection-store.ts` | Inspector routing |
| Server load/save (pattern) | `editor/server/api-plugin.ts` | Concept only → tRPC + Postgres |
| A-roll surgery | `editor/src/lib/sections.ts`, `editor/src/lib/cuts.ts` | Cut-centric → rewrite around `ArollKeep` + **ripple** |
| Transcript panel | `editor/src/components/transcript/TranscriptPanel.tsx`, `cells/{Word,Gap,GhostGap,RangeHandle}.tsx` | |
| Word chrome mapping | `editor/src/lib/word-annotations.ts`, `word-classes.ts` | Emphasis CSS: one emphasized style, not pos/neg |
| Range resize / drag-select | `editor/src/components/transcript/hooks/useRangeResize.ts`, `editor/src/lib/use-caption-drag-select.ts` | |
| Timeline | `editor/src/components/timeline/Timeline.tsx`, `tracks/VideoTrack.tsx`, `cells/{SectionCell,GapCell}.tsx`, `Playhead.tsx` | |
| Zoom track | `editor/src/components/timeline/tracks/PunchInTrack.tsx` | → zoom Edit cells |
| Caption track | `editor/src/components/timeline/tracks/CaptionTrack.tsx` | Project-field track |
| Player host | `editor/src/components/PlayerPanel.tsx`, `editor/src/lib/player-bridge.ts` | |
| Composition | `src/TalkingHead.tsx`, `src/Root.tsx`, `src/lib/episode/constants.ts` | 1080×1920@30 |
| Captions render | `src/components/captions/TikTokCaptions.tsx` (+ siblings under `captions/`) | |
| Text / zoom primitives | `src/components/TikTokText.tsx`, `src/components/PunchIn.tsx` | |
| Props build | `src/lib/episode/build-props.ts` | Global edits; multi-aroll stitch |
| Place zoom / text | `editor/src/lib/punchin.ts`, `editor/src/lib/vfx.ts` | Flat `edits[]` + EditId |
| Badges / inspectors (baseline) | `transcript/badge/PunchInBadge.tsx`, `VfxBadge.tsx`, `inspector/ZoomInspector.tsx`, `TextVfxInspector.tsx` | |
| Caption catalogs (baseline) | `src/lib/captions/{templates,style,parse-style}.ts` | Unify as TemplateStyle |
| UI kit (as needed) | `editor/src/components/ui/*` | Prototype **new-york** Radix; th2 **shadcn base-nova** — port behavior, not blind file copy |
| Assets shell | `editor/src/components/assets/AssetsPanel.tsx` | |

### Differences vs prototype editor

- Load path: tRPC + signed media URLs, not Vite middleware + `public/episodes/`.
- Transcript is **global projection** across multi-asset arolls (prototype: single source timeline, cut words skipped).
- Autosave whole ProjectConfig + `configUpdatedAt` conflict; transcript emphasis may be separate mutation.
- Ripple after delete/restore (new).
- No listicle / location / shake / music tracks in v1 shell.

### Steps

#### 4.1 Load + Controller

1. tRPC `project.byId` (owner, `ready` or allow read-only `exporting`): config, assets, transcripts, signed media URLs.
2. Port MVC layout under e.g. `src/domain/` + `src/editor/`:
   - Model: arolls surgery, ripple, edit CRUD stubs, captions field patch
   - Controller: Zustand store (from `editor/src/store.ts` patterns), undo stack (full config snapshots), selection
3. Debounced autosave `project.updateConfig` with `configUpdatedAt` conflict check.
4. Route layout matching wireframe: Assets | Transcript | Player / Timeline bottom.

#### 4.2 Assets panel

1. List project assets; show global SFX later (M5) — for now A-roll videos.
2. Optional: upload additional A-roll/b-roll later; not required for M4 if create covers A-roll.

#### 4.3 Transcript (global projection)

1. Project words through `arolls` → one continuous transcript (adapt `source-timeline.ts`).
2. Primitives: word rendering; selection range; delete range → Model arolls surgery + ripple.
3. Virtual gap indication (collapsed markers OK) — port Gap/GhostGap ideas.
4. Toggle word `emphasized` (Controller → persist transcript update tRPC).

#### 4.4 Timeline

1. Tracks: A-roll (keep/gap cells), placeholder tracks for edits.
2. A-roll cells from `arolls`; gap cells derived.
3. Playhead scrub sync with Player/Transcript.
4. Edit cells for existing zooms/title text from create.

#### 4.5 Player

1. Remotion composition: 1080×1920@30, A-roll stitch from keeps, basic captions from TemplateStyle + projected words + emphasis — port `TalkingHead.tsx` + caption/text/zoom primitives.
2. `@remotion/player` in editor; shared primitive modules (Media, Text, Zoom).
3. Resolve `ProjectConfig` → `ProjectProps` (port/adapt `build-props.ts`).

#### 4.6 Transcript chrome for edits

1. Markers / underline / highlight / handles for zoom + vfx/text on transcript.
2. Resize via handles updates edit global range (Model clamp).

**Done when:** Open ready project; scrub; delete speech range and see ripple; autosave reload; preview shows stitched A-roll + captions.

---

## Milestone 4b — Export (Remotion Lambda)

**Goal:** Export button renders current snapshot to S3; status machine honored.

### Prototype sources

| Concern | Copy from | Notes |
|---------|-----------|--------|
| Local render orchestration | `cli/render-episode.ts` | Bundle + render + cover still — **composition parity**, not deploy target |
| Export UI / flush save | `editor/src/components/ExportButton.tsx` | Progress UX; call tRPC export instead of local stream |
| Remotion entry | `src/Root.tsx`, `src/index.ts`, `remotion.config.ts` | |
| Cover still (optional) | `src/Cover.tsx` | Nice-to-have for posters later |
| Export API stream | `editor/server/api-plugin.ts` | Pattern only → Vercel Workflow + Lambda |

### Differences

- Remotion **Lambda** + IAM + private S3 write; no local `renderMedia` as product path.
- Status: `ready → exporting → ready` (+ `failureReason` on export fail); editing allowed during export (snapshot at click).
- Download via signed GET on `exportS3Key`, not filesystem path.

### Steps

1. Remotion Lambda site/deploy (IAM, function, region); env wired in T3 env schema.
2. tRPC `project.export`: require `status===ready`; snapshot config+props+media references; set `exporting`; `start(exportWorkflow)`.
3. Export workflow: render Lambda → write `exports/{projectId}/{timestamp}.mp4` → set `exportS3Key`, `status=ready`, clear `failureReason`; on error `status=ready` + `failureReason`.
4. UI: Export disabled while `exporting`; show progress via poll; Download uses signed GET on `exportS3Key`. Port progress chrome from `ExportButton.tsx` where useful.
5. Guard: reject second export while `exporting`.
6. Verify preview≈export for A-roll + captions + zooms + title text + emphasis.

**Done when:** User can download a vertical MP4 matching editor baseline.

---

## Milestone 5 — Editor features (priority order)

Each feature vertical slice: **Model** (types + place/patch/remove) → **Controller** (Zustand) → **transcript chrome** → **timeline cell** → **player primitive** via shared Remotion path. Export parity = same composition/props (M4b not required to finish M5; do not block on Lambda).

### Agent brief (M5)

**Mission:** Flesh the M4 editor shell into the priority feature set (5.1→5.5). Ship each slice end-to-end in the editor Player before moving on. Do **not** implement M4b Lambda, listicle, location/shake/cutout, music, or social schedule.

**Read first:** `CONTEXT.md` (Edit kinds, TemplateStyle, Project field vs Edit, composition matrix); this M5 section; existing editor/Remotion/domain below.

**Constraints:**
- Prefer type-only imports; no prototype mentions in source comments (PLAN only).
- Persist sparse `TemplateStyle` `{ templateId, overrides? }` — resolve at props time only.
- Flat `edits[]` + `EditBase` + `kind` / `vfx.type`; extend `BrollEdit` / `SfxEdit` fields as needed (transforms, volume, etc.) with Zod updates in `project-config.ts`.
- Do not commit; do not print secrets.
- `npm run typecheck` must pass after each slice.
- Update PLAN Status M5 notes as slices complete (e.g. `5.1–5.2 done` → full Done when 5.1–5.5 land).

**Already in th2 (reuse — do not re-scaffold):**
- Editor shell: `src/editor/{store,selection-store}.ts`, `components/{EditorShell,AssetsPanel,TranscriptPanel,PlayerPanel,Timeline}.tsx`
- Domain: `project-config` (includes stub `BrollEdit` / `SfxEdit` / `VfxQuoteEdit`), `edits.ts` (zoom + text place/patch), `arolls.ts`, `projection.ts`
- Remotion: `src/remotion/{TalkingHead,build-props,types}.ts`, `components/{Captions,TextOverlay,Zoom}.tsx`, `captions/templates.ts` (partial catalog — extend, don’t fork)
- Media: S3 presign + CloudFront signed GET; Asset table already supports `kind` + nullable `projectId`
- Autosave: `project.updateConfig` / `updateTranscriptWords`

**Gaps vs M5:**
- Captions UI / full style overrides / richer Remotion caption animation
- Text VFX inspector + place-from-selection + text template catalog
- B-roll: upload API, transform fields on edit, overlay, timeline/transcript chrome
- Global SFX seed + place/play audio edits
- Quote VFX place + caption style override merge in `build-props`

**Suggested target files (add as needed):**
```
src/domain/edits.ts                 # placeBroll, placeSfx, placeQuote, patch helpers
src/domain/project-config.ts        # extend BrollEdit/SfxEdit (+ Zod)
src/remotion/captions/*             # full resolve + group/animation if needed
src/remotion/text/templates.ts
src/remotion/components/BRollOverlay.tsx
src/remotion/components/SfxAudio.tsx
src/editor/components/inspector/*   # Captions, Text, BRoll, Sfx, Quote
src/editor/components/assets/*      # upload tab, SFX picker
src/server/api/routers/asset.ts     # or project.* : uploadStart for image/video/audio
scripts/seed-global-sfx.ts          # S3 + Asset rows projectId=null
```

**Shared editor UX rules:**
- Place from transcript word selection (global range) unless noted.
- Selection store routes to the correct inspector.
- Timeline: one track (or lane) per kind; cells resize → `patchEditRange`.
- Player must use the same `buildProjectProps` / `TalkingHead` path as future export.

**Export / M4b:** Do not implement Lambda in M5. Ensure new layers are in Remotion composition so M4b is automatic later.

### 5.1 Captions — Dynamic Styling

**Copy from (sibling talking-head):** `src/lib/captions/{templates,style,parse-style}.ts`; Remotion `src/components/captions/*`; UI `editor/src/components/inspector/CaptionsInspector.tsx` (+ style fields / template picker / preview).

**Diff:** Single Project field `captions: TemplateStyle` (already). Extend overrides typing beyond `Record<string, unknown>` if useful; merge into resolve used by `src/remotion/components/Captions.tsx`.

**Steps:**
1. Flesh catalog + `resolveCaptionStyle(templateStyle)` (base + sparse overrides).
2. Captions inspector: template picker + override controls; writes `config.captions` via store/autosave.
3. Player reflects changes immediately via props rebuild.

**Done when:** User can switch template and tweak overrides; preview updates; reload persists.

### 5.2 Title — Static / text VFX

**Copy from:** text templates `src/lib/text/templates.ts`; player `TikTokText.tsx`; `TextVfxInspector.tsx`; place/patch patterns in `editor/src/lib/vfx.ts`. Seed duration already `DEFAULT_TEXT_VFX_DURATION_SEC`.

**Diff:** Deleting `vfx/text` must **not** clear `Project.title` column; no sync after seed. Create already seeds one text VFX — add place + inspector.

**Steps:**
1. Port text template catalog; resolve into `TextOverlay`.
2. Inspector for selected text VFX: text, range, `TemplateStyle`.
3. Place new text VFX from transcript selection (Controller → `placeTextVfx`).
4. Inline rename for `Project.title` on projects card or editor header (separate from overlay text).

**Done when:** Place/edit/delete title overlay; project title metadata independent; preview matches.

### 5.3 B-roll — Transform + Player Inspector

**Copy from:** `editor/src/lib/broll.ts`; `config-types.ts` `SourceBRoll`; `src/lib/visual/{broll-layout,ken-burns}.ts`; `BRollOverlay.tsx`; timeline/transcript/inspector/import modules; `DEFAULT_BROLL_ENTRANCE_SFX`.

**Diff:** S3 Asset rows (`kind: image|video`); `kind: "broll"` edit, global times. Extend type beyond `{ assetId }` — at minimum transform fields used by layout (scale, offset, kenBurns, behind, mediaOffsetSec, optional entrance sfx asset id).

**Steps:**
1. tRPC + Assets panel: presigned upload for project image/video → Asset rows.
2. Model `placeBroll` / patch transform; store actions.
3. Place from selection + asset pick; inspector (transform + optional entrance SFX when 5.4 exists — stub field OK until then).
4. Timeline b-roll track; transcript marker; `BRollOverlay` in `TalkingHead`.

**Done when:** Upload → place → transform → see overlay in Player; autosave reload.

### 5.4 SFX — Audio adjustment

**Copy from:** `editor/src/lib/sfx.ts`; `SfxOverlay.tsx`; Sfx tab/track/badge/inspector; `mix-levels.ts`; pack `public/sfx/**` + `loudness.json`.

**Diff:** Global Assets (`projectId=null`); Remotion loads via signed URL / resolved src from Asset id, not `public/sfx/...` paths in config.

**Steps:**
1. `scripts/seed-global-sfx.ts`: upload pack to S3, insert global Asset rows (idempotent).
2. tRPC list global audio assets for picker.
3. `placeSfx` + volume/offset; timeline + transcript icon; audio layer in Player.
4. Wire b-roll entrance SFX picker to global pack if 5.3 stubbed it.

**Done when:** Seed script run once; place SFX; hear in Player; persists.

### 5.5 Quotes — Conditional Styling

**Copy from:** `src/lib/captions/quote-templates.ts`; quote restyle in `build-props.ts`; `QuoteVfxInspector.tsx`; `editor/src/lib/vfx.ts`.

**Diff:** `VfxQuoteEdit` already typed; implement place + props merge so quote range overrides caption `TemplateStyle` while active.

**Steps:**
1. Quote template catalog + resolve.
2. `placeQuote` from selection; inspector for template/overrides.
3. `build-props` / Captions: apply quote style over caption style for overlapping words.
4. Transcript/timeline chrome.

**Done when:** Place quote; captions restyle in range; preview + autosave.

### M5 acceptance (milestone)

- [ ] 5.1–5.5 each meet their slice “Done when”
- [ ] All new edits survive autosave reload
- [ ] Player composition includes b-roll + sfx + quote paths (export-ready)
- [ ] `npm run typecheck` passes
- [ ] PLAN Status updated

### Explicitly do not port (v1)

| Area | Sibling paths (reference only) |
|------|-------------------------------|
| Listicle | `cli/modules/listicles.ts`, listicle Remotion/editor modules |
| Location / shake / cutout | cutout modules, location/shake inspectors |
| Music | Music overlay / tab / track |
| Social schedule | `cli/schedule/**` |
| M4b Lambda | Separate milestone — composition parity only here |

---

## Cross-cutting (do once, reuse)

| Workstream | When | Prototype / notes |
|------------|------|-------------------|
| CONTEXT vocabulary in code names | M3–M4 | Contrast `talking-head/CONTEXT.md` (Episode) vs this repo’s CONTEXT |
| Domain type hubs | M3 | Start from `src/lib/episode/{config,transcript,props,pipeline}-types.ts` → reshape |
| Signed media URL helper | M3 | New (`infra` CloudFront); replaces `link-public.ts` |
| Owner authorization helper | M2 | New (no prototype) |
| OpenAI env | M3 | Same providers as `cli/modules/*` |
| Replicate env | M3 | New (replaces local whispermlx) |
| Global SFX seed | before 5.4 | Copy assets from `public/sfx/**` + loudness metadata |
| UI theme tokens | M4 | Prototype `editor/src/index.css`; th2 already mapped brand tokens onto shadcn |
| Deprioritized | — | Listicle, location/shake/cutout, music, regenerate AI, teams |

---

## Suggested implementation order (first PR slices)

1. M1 landing + auth gate  
2. M2 Project schema + list UI  
3. M3.1 Asset/Transcript/S3 + presign *(infra deployed)*  
4. M3.2 createStart/upload client  
5. M3.3 workflow skeleton (transcribe one file → ready with full-keep arolls)  
6. M3.3 keep builder (`cuts.ts` inverted) + AI steps (`title` / `punchin` / `emphasis`)  
7. M4 editor load + autosave (`store.ts` patterns) + transcript projection + delete/ripple  
8. M4 Remotion player stitch (`TalkingHead.tsx` + `build-props.ts`)  
9. M4b Lambda export (parity with `render-episode.ts` output)  
10. M5.1 → 5.5 in order (each: port listed prototype modules into flat-edit + S3 world)  

---

## Open items (from CONTEXT)

Resolve during the relevant milestone, not upfront:

- Default seeded title `vfx/text` duration — start from `DEFAULT_TEXT_VFX_DURATION_SEC` in prototype `cli/helpers/constants.ts`
- Projects grid poster/thumbnail source — optional port of cover still from `src/Cover.tsx` / render cover
- Overlapping underline stacking — match prototype transcript chrome behavior unless UX says otherwise
- Default b-roll entrance SFX on place — `DEFAULT_BROLL_ENTRANCE_SFX` in prototype `config-types.ts`
