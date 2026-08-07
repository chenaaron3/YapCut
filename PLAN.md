# Talking Head 2 — Milestone Plan

Executable breakdown aligned with [CONTEXT.md](./CONTEXT.md). Stack: T3 (Next.js, tRPC, Drizzle, Auth.js), S3, Vercel Workflows, Remotion Player + Lambda, Replicate WhisperX.

---

## Milestone 1 — Landing + login

**Goal:** Bare landing page with Google login; unauthenticated users cannot reach app routes.

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

### Steps

#### 3.1 Schema + storage

1. `Asset` table: `id`, `projectId` (nullable), `kind` (`video|image|audio`), `s3Key`, `contentType`, `durationSec`, `originalFilename`, timestamps.
2. `Transcript` table: `id`, `assetId` (unique), `words` (jsonb), `durationSec`, `language`, `status`, `raw` (optional jsonb), timestamps.
3. S3 bucket (private); IAM user/role for app; env for bucket/region.
4. Helpers: presigned PUT (upload), presigned GET (read); key layout e.g. `projects/{projectId}/{assetId}/source`.

#### 3.2 Create API

1. tRPC `project.createStart`: validate session; create Project `status=processing`, title optional from modal; create Asset rows; return presigned upload URLs + project id.
2. Client: modal accepts **video only**; parallel uploads; on all complete call `project.createFinalize` (or auto-detect uploads complete) → `start(createProjectWorkflow, [projectId])`.
3. Reject zero videos; ignore non-video in UI.

#### 3.3 Vercel Workflow — create

1. Add Workflow SDK (`workflow` + `withWorkflow` in Next config); `vercel link` / env pull for local.
2. Workflow steps per asset:
   - Verify object in S3; probe duration (ffprobe via step or Remotion/mediabunny later — minimum: trust client then WhisperX duration).
   - Call Replicate `victor-upmeet/whisperx` (autodetect language, diarization off); poll/sleep or webhook hook until done.
   - Normalize → `Transcript.words[]` (text, start, end); mark transcript ready.
3. Keep builder (port `buildCutsFromWords` logic → **emit `ArollKeep[]`**, not delete cuts); concatenate assets in upload/drop order into `config.arolls`.
4. Build global projected word list from arolls + transcripts.
5. AI steps (OpenAI structured output, always on):
   - Title if `project.title` empty → update column + seed `vfx/text` edit.
   - Zooms → `kind: "zoom"` edits (global times).
   - Emphasis → set `emphasized: true` on mapped per-asset words.
6. Seed `captions: { templateId: default }`; set `status=ready` (or `failed` + `failureReason`).
7. Projects UI: poll `project.byId` / list while `processing`; show failure state.

#### 3.4 Types

1. Shared Zod/TS types: `ProjectConfig`, `ArollKeep`, `Edit` union, `TemplateStyle`, transcript word.
2. Initial empty/partial config constants.

**Done when:** Multi-clip upload leaves a `ready` project with stitched keeps, transcripts, AI zooms/emphasis, seeded title overlay + captions; failures surface `failed`.

---

## Milestone 4 — Editor shell

**Goal:** `/projects/[id]` editor with Assets, Transcript, Player, Timeline — topology editing (keeps/ripple), selection, autosave. Remotion compositions exist for A-roll + captions baseline.

### Steps

#### 4.1 Load + Controller

1. tRPC `project.byId` (owner, `ready` or allow read-only `exporting`): config, assets, transcripts, signed media URLs.
2. Port MVC layout under e.g. `src/domain/` + `src/editor/`:
   - Model: arolls surgery, ripple, edit CRUD stubs, captions field patch
   - Controller: Zustand store, undo stack (full config snapshots), selection
3. Debounced autosave `project.updateConfig` with `configUpdatedAt` conflict check.
4. Route layout matching wireframe: Assets | Transcript | Player / Timeline bottom.

#### 4.2 Assets panel

1. List project assets; show global SFX later (M5) — for now A-roll videos.
2. Optional: upload additional A-roll/b-roll later; not required for M4 if create covers A-roll.

#### 4.3 Transcript (global projection)

1. Project words through `arolls` → one continuous transcript.
2. Primitives: word rendering; selection range; delete range → Model arolls surgery + ripple.
3. Virtual gap indication (collapsed markers OK).
4. Toggle word `emphasized` (Controller → persist transcript update tRPC).

#### 4.4 Timeline

1. Tracks: A-roll (keep/gap cells), placeholder tracks for edits.
2. A-roll cells from `arolls`; gap cells derived.
3. Playhead scrub sync with Player/Transcript.
4. Edit cells for existing zooms/title text from create.

#### 4.5 Player

1. Remotion composition: 1080×1920@30, A-roll stitch from keeps, basic captions from TemplateStyle + projected words + emphasis.
2. `@remotion/player` in editor; shared primitive modules (Media, Text, Zoom stub).
3. Resolve `ProjectConfig` → `ProjectProps` (port/adapt `build-props` ideas).

#### 4.6 Transcript chrome for edits

1. Markers / underline / highlight / handles for zoom + vfx/text on transcript.
2. Resize via handles updates edit global range (Model clamp).

**Done when:** Open ready project; scrub; delete speech range and see ripple; autosave reload; preview shows stitched A-roll + captions.

---

## Milestone 4b — Export (Remotion Lambda)

**Goal:** Export button renders current snapshot to S3; status machine honored.

### Steps

1. Remotion Lambda site/deploy (IAM, function, region); env wired in T3 env schema.
2. tRPC `project.export`: require `status===ready`; snapshot config+props+media references; set `exporting`; `start(exportWorkflow)`.
3. Export workflow: render Lambda → write `exports/{projectId}/{timestamp}.mp4` → set `exportS3Key`, `status=ready`, clear `failureReason`; on error `status=ready` + `failureReason`.
4. UI: Export disabled while `exporting`; show progress via poll; Download uses signed GET on `exportS3Key`.
5. Guard: reject second export while `exporting`.
6. Verify preview≈export for A-roll + captions + zooms + title text + emphasis.

**Done when:** User can download a vertical MP4 matching editor baseline.

---

## Milestone 5 — Editor features (priority order)

Each feature: Model type + Controller place/patch/remove + transcript chrome + timeline cell + player primitive + export parity.

### 5.1 Captions — Dynamic Styling

1. Port caption template catalog + `CaptionStyleOverrides`.
2. `TemplateStyle` Project field UI (template picker + override controls).
3. Props resolution merge; Player + Lambda pick up changes.

### 5.2 Title — Static / text VFX

1. Inspector for selected `vfx/text`: text, range, `TemplateStyle`.
2. Place new text VFX from transcript selection (not only create seed).
3. Port text template catalog.
4. Deleting title overlay does not clear `Project.title` column; rename project elsewhere (inline on projects page or editor header).

### 5.3 B-roll — Transform + Player Inspector

1. Upload project `image`/`video` assets from editor Assets panel (presign + create Asset).
2. Place `broll` edit from transcript selection + asset pick.
3. Transform controls (position/scale/kenBurns/behind as you port); optional entrance SFX place-seed.
4. Timeline b-roll track; transcript marker (thumb); Media layer in Player/export.

### 5.4 SFX — Audio adjustment

1. Seed script: upload global SFX pack + insert `Asset` rows (`projectId=null`, `kind=audio`).
2. SFX picker: globals (+ project audio if any).
3. Place `sfx` edit; volume/offset controls as needed.
4. Audio layer in Player/export; transcript icon marker.

### 5.5 Quotes — Conditional Styling

1. `vfx/quote` edit + quote template catalog.
2. Props: quote range overrides caption `TemplateStyle` merge.
3. Transcript/timeline chrome; inspector for template/overrides.

**Done when:** Priority features work end-to-end in editor and export.

---

## Cross-cutting (do once, reuse)

| Workstream | When | Notes |
|------------|------|--------|
| CONTEXT vocabulary in code names | M3–M4 | `ProjectConfig`, `ArollKeep`, EditId, etc. |
| Signed media URL helper | M3 | Short TTL; Lambda prefers IAM |
| Owner authorization helper | M2 | Every project/asset procedure |
| OpenAI env | M3 | Title/zooms/emphasis |
| Replicate env | M3 | WhisperX |
| Global SFX seed | before 5.4 | Script + manifest |
| Deprioritized | — | Listicle, location/shake/cutout, music, regenerate AI, teams |

---

## Suggested implementation order (first PR slices)

1. M1 landing + auth gate  
2. M2 Project schema + list UI  
3. M3.1 Asset/Transcript/S3 + presign  
4. M3.2 createStart/upload client  
5. M3.3 workflow skeleton (transcribe one file → ready with full-keep arolls)  
6. M3.3 keep builder + AI steps  
7. M4 editor load + autosave + transcript projection + delete/ripple  
8. M4 Remotion player stitch  
9. M4b Lambda export  
10. M5.1 → 5.5 in order  

---

## Open items (from CONTEXT)

Resolve during the relevant milestone, not upfront:

- Default seeded title `vfx/text` duration  
- Projects grid poster/thumbnail source  
- Overlapping underline stacking  
- Default b-roll entrance SFX on place  
