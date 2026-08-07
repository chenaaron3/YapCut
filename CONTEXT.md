# Talking Head 2

Domain language for the project editor, create pipeline, and Remotion render path. Architecture reviews and refactors should use these terms.

Production rewrite of the `talking-head` prototype: T3 stack, S3 assets, Postgres config/transcripts, multi A-roll, unified edits.

## Language

### Product / persistence

**Project**:
One deliverable video. Owned by a single user. Display name is `Project.title` (DB column — not inside config).
_Avoid_: Episode (prototype term), episode title as config field

**ProjectConfig**:
Sparse JSON document on the Project row: topology (`arolls`), flat `edits`, and Project fields (e.g. `captions`). Editor holds an in-memory copy and debounced-autosaves the whole blob.
_Avoid_: config blob (prefer ProjectConfig), row-per-edit, parallel kind arrays (`bRolls` / `vfx` / …)

**Project field**:
Project-level config data that is not an Edit and has no EditId. Today: `captions` (`TemplateStyle`). Later: music. Title string is a Project column, not a Project field.
_Avoid_: treating captions/music as Edits; treating on-screen title overlay as the Project.title column

**Asset**:
Media object in private S3. `kind: "video" | "image" | "audio"`. `projectId` set ⇒ project-scoped; `projectId` null ⇒ **global** library (SFX pack). Create-flow uploads are project-scoped A-roll videos only.
_Avoid_: is_visual / is_audio booleans, public URLs as source of truth

**Transcript**:
Word-level transcription for one Asset (0..1). Stored as JSONB `words[]` (local timestamps on that asset) plus duration/status. Emphasis is an optional boolean on a word (`emphasized`), not sentiment.
_Avoid_: normalized word rows, global persisted transcript copy, positive/negative emphasis

**Aroll keep** (`ArollKeep`):
One segment to keep from an A-roll asset: `{ assetId, start, end }` in **local** asset time. `ProjectConfig.arolls` is a flat ordered list; array order is stitch order on the global timeline.
_Avoid_: Cut (prototype delete-range), storing keep lists grouped by asset as source of truth, parallel delete array

**Deleted / gap cell**:
Timeline View chrome for media not in `arolls` (between keeps or trimmed ends). Derived in the View — never stored as topology.
_Avoid_: Cut as persisted model type

### Model (ProjectConfig)

**Edit**:
A ranged overlay on the **global** (stitched) timeline. Flat `edits[]` with one discriminant `kind`. Mutated through shared Model CRUD.
_Avoid_: clip (ambiguous), local-time edits, kind+type nesting except `vfx.type`

**EditId**:
Monotonic integer identifying an Edit. Assigned at place as `max(ids)+1`; never reused after delete.
_Avoid_: uuid, array index, string ids

**Edit kinds (v1)**:
```
broll | sfx | zoom | vfx
```
- **zoom** — punch-in (scale)
- **vfx** — `type: "quote" | "text"` only (listicle deferred; location/shake/cutout out of scope)

**TemplateStyle**:
`{ templateId, overrides? }` — catalog base + sparse user overrides. Used by Project field `captions` and by `vfx` quote/text. Resolve at props time; do not persist fully resolved style.
_Avoid_: parallel `captionTemplateId` + `captionStyle` fields, dumping resolved style into config

**No-op default / Place seed**:
Same spirit as prototype: omit means identity at props time; place may write on-seeds (e.g. entrance SFX) once.

**Clean break**:
No dual-read of prototype YAML shapes, string edit ids, or `cuts` delete lists.

### Coordinates

**Local timestamp**:
Seconds on a single Asset’s media timeline. Used by `ArollKeep` and Transcript words.

**Global timestamp**:
Seconds on the stitched output timeline (sum of keep durations in `arolls` order). Used by all Edits and by the editor Transcript/Timeline/Player UX.

**Projection**:
Derive global words / playhead mapping from `arolls` + per-asset transcripts. Do not persist a separate global transcript.

**Ripple**:
After arolls surgery (delete or restore-gap), clamp/remove overlapping edits, then shift later edits’ global `start`/`end` by ±deleted duration so the UX stays “one video.”

### MVC

**Model**:
Pure ProjectConfig (and transcript emphasis) transforms. No Zustand, no Remotion.
_Avoid_: store logic in Model, View writing config

**Controller**:
Zustand actions: call Model, commit, live gestures, undo (full-config snapshots), selection side effects. Debounced autosave to Postgres.

**View**:
React editor + Remotion player/export. Composes View primitives. Kind modules choose primitives; they do not reimplement range chrome.

### View — transcript primitives

**Transcript marker**, **Handle**, **Highlight**, **Underline**:
Same composition rules as prototype: marker ⇒ idle underline; selected ⇒ highlight + handles. Appearance is kind-specific.

### View — timeline primitives

**Track**, **Keep/cut cell** (keep vs derived gap), **Edit cell**:
A-roll track shows keep/gap cells from `arolls`. Each Edit gets an Edit cell on its track. Captions bind as a Project-field track when shown.

### View — player primitives

**Text overlay**, **Zoom**, **Media layer**, **Audio layer**:
Shared modules for editor preview (`@remotion/player`) and Lambda export. Consume resolved **ProjectProps**, not sparse omit semantics.

**ProjectProps**:
Fully resolved render DTO (defaults materialized). Built from ProjectConfig + assets + projected transcripts.

## Status

Single mega-status on Project:

| Status | Meaning |
|--------|---------|
| `processing` | Create workflow running |
| `ready` | Editable; may have prior `exportS3Key` |
| `exporting` | Lambda render in flight |
| `failed` | Create failed (editor not openable) |

Transitions: `processing → ready | failed`; `ready → exporting`; `exporting → ready` (set `exportS3Key` on success, set `failureReason` on export failure and return to `ready`). Create failure uses `failed` + `failureReason`.

Export is a snapshot at click; editing during `exporting` is allowed. Only one export at a time.

## Pipelines

**Create workflow** (Vercel Workflows):
1. Presigned upload → Project + Assets (`processing`)
2. WhisperX per A-roll video (language autodetect, diarization off) → Transcript rows
3. Keep builder (fillers + long gaps) → `arolls`
4. AI assist (always on, create-only): title if empty → `Project.title` + seed `vfx/text`; zooms → `zoom` edits; emphasis → boolean on transcript words — all on **global projected** transcript
5. Seed default `captions` TemplateStyle → `ready`

**Export workflow**:
Remotion Lambda; private S3 via IAM (editor uses signed URLs). Output 1080×1920 @ 30fps.

## Relationships

- Project has many Assets; Asset has 0..1 Transcript
- Global Assets have `projectId = null` (seeded SFX); edits reference any Asset by id
- ProjectConfig.arolls reference project video Assets
- Edits use global time; arolls use local time
- On-screen title is a `vfx`/`text` Edit (seeded, deletable); `Project.title` is metadata only and is not kept in sync after seed
- Captions are a Project field (`TemplateStyle`); quote VFX overrides caption look over a range at props time

## Composition matrix (v1)

| Concern | Model | Transcript chrome | Timeline | Player |
|---------|--------|-------------------|----------|--------|
| b-roll | Edit | yes | Edit cell | Media (+ Audio if entrance sfx) |
| sfx | Edit | yes | Edit cell | Audio layer |
| zoom | Edit | yes | Edit cell | Zoom |
| vfx/quote | Edit | yes | Edit cell | Caption style override (+ text as applicable) |
| vfx/text | Edit | yes | Edit cell | Text overlay |
| captions | Project field | no | optional track | Text overlay (words from projection) |
| arolls | topology | — | Keep/gap cells | A-roll Media |
| emphasis | Transcript word flag | (caption styling) | — | caption word style |

## Deprioritized / out of scope

- Listicle (+ marker/reveal)
- Location VFX, shake VFX, cutout greenscreen
- Music (Project field later)
- LLM regenerate-in-editor; listicle/emphasis process flags
- Teams/sharing; user upload to global library
- Per-project dimensions/fps

## Flagged ambiguities

- Exact default duration/range for seeded title `vfx/text`
- Whether b-roll entrance SFX is place-seeded by default (port later with b-roll feature)
- Poster/thumbnail for projects grid
- Overlapping idle underlines: stack vs priority
