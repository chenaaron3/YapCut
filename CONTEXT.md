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
Project-level config data that is not an Edit and has no EditId. Today: `captions` (`TemplateStyle`), `defaultBRollSfxAssetId` (global audio Asset id or null — place-time sibling `sfx` edit when dropping b-roll). Later: music. Title string is a Project column, not a Project field.
_Avoid_: treating captions/music as Edits; nesting entrance SFX on `BrollEdit`; treating on-screen title overlay as the Project.title column

**Asset**:
Media object in private S3. `kind: "video" | "image" | "audio"`. `projectId` set ⇒ project-scoped; `projectId` null ⇒ **global** library (SFX pack). Create-flow uploads are project-scoped A-roll videos only.
_Avoid_: is_visual / is_audio booleans, public URLs as source of truth

**Transcript**:
Word-level transcription for one Asset (0..1). Stored as JSONB `words[]` (local timestamps on that asset) plus duration/status. Emphasis is an optional boolean on a word (`emphasized`), not sentiment. Same flag everywhere: two AI passes unioned — sparse across the whole script, then denser (most content words) inside each quote punch phrase.
_Avoid_: normalized word rows, global persisted transcript copy, positive/negative emphasis, a second “quote emphasis” type

**Aroll keep** (`ArollKeep`):
One segment to keep from an A-roll asset: `{ assetId, start, end }` in **local** asset time. `ProjectConfig.arolls` is a flat ordered list; array order is stitch order on the timeline / output. Keeps for the same asset are **contiguous** in that list (no interleaving another asset between two keeps of one asset — you cannot cut part of a clip and place it after a different asset).
_Avoid_: Cut (prototype delete-range), storing keep lists grouped by asset as source of truth, parallel delete array, A→B→A stitch order

**Deleted / gap cell**:
Timeline View chrome for media not in `arolls` (between keeps or trimmed ends). Derived in the View — never stored as topology.
_Avoid_: Cut as persisted model type

### Model (ProjectConfig)

**Edit**:
A ranged overlay on the **timeline** (expanded; gaps count). Flat `edits[]` with one discriminant `kind`. Mutated through shared Model CRUD.
_Avoid_: clip (ambiguous), local-time edits, output-time edits, kind+type nesting except `vfx.type`

**EditId**:
Monotonic integer identifying an Edit. Assigned at place as `max(ids)+1`; never reused after delete.
_Avoid_: uuid, array index, string ids

**Edit kinds (v1)**:
```
broll | sfx | zoom | vfx
```
- **zoom** — end-keyframe `Transform` + optional `ease` (omit/false = hard **punch-in**; true = **slow zoom** ease identity → end over the range)
- **vfx** — `type: "quote" | "text" | "listicle" | "shake"` (location/cutout out of scope)

**Punch-in**:
Hard zoom (`ease` false/omitted). Create zoom AI prefers these as intentional camera hits.
_Avoid_: treating every zoom as a punch-in

**Slow zoom**:
Eased zoom used by **pacing reconcile** on bare sentences (no overlapping edits, ≥5 words) when the LLM says yes — covers the entire sentence.
_Avoid_: filling dry stretches with standalone SFX; partial-sentence slow zooms

**Punch phrase**:
Short high-impact key-phrase span for a quote VFX (~3–10 words), not a full sentence. AI always starts the first quote at word 0 (hook); later quotes only on true key phrases, ≥5 words between spans — prefer spaced subsets over merging past the word limit.
_Avoid_: quote-as-paragraph, quote overlapping listicle, packing ordinary connective speech, back-to-back quotes

**Companion SFX**:
An `sfx` Edit placed beside an eligible visual moment (punch-in, quote peak, listicle indicator/value, title card). Optional per candidate (`none` allowed). Not used to plug pacing gaps. AI does not place hook-riser (`build`) companions.
_Avoid_: nesting SFX on zoom/vfx; free-placement SFX as gap filler; SFX on sparse outer emphasis; SFX on slow zooms

**AI SFX pack**:
Curated role × intensity (`soft`/`medium`/`hard`) for create AI only. Roles: `reveal` (title + listicle indicator), `tick` (listicle value), `ping` (quote peak), `motion` (punch-in); pack also has `build` (hook riser) but AI does not candidate it. LLM picks `role.intensity` or `none`; place-time hash picks one Asset from `public/sfx/<role>/<intensity>/`. Intensity sets volume. `custom/memes/` is manual library only.
_Avoid_: letting the LLM choose from the entire global library; `texture` roles (typing/flash); meme in AI pool; hardcoding asset UUIDs in the pack

**Beat**:
A visible or audible onset that resets pacing: punch-in start, quote start, listicle indicator start and value middle (when staggered), emphasized word start, seeded title `vfx/text` start. Target: about one beat every ~3s of keep/output time (~2s in the **hook**).
_Avoid_: counting only edits (emphasis counts); using SFX to satisfy the floor; measuring across deleted gap cells

**Hook**:
Opening ~10s of keep/output time; heavier editing (tighter beat target, bias toward early punch-in and/or quote).
_Avoid_: undefined “intro”; applying hook density to the whole video

**Pacing reconcile**:
Create AI pass after visual set pieces + emphasis: code lists bare sentences (≥5 words, no overlapping edits); LLM returns yes/no per sentence; yes → slow zoom over the full sentence.
_Avoid_: early zoom step owning slow fillers; gap-index / partial-phrase slow zooms; reconcile inventing standalone SFX

**TemplateStyle**:
`{ templateId, overrides? }` — catalog base + sparse user overrides. Used by Project fields `captions` / `listicleStyle` and by `vfx` quote/text. Resolve at props time; do not persist fully resolved style.
_Avoid_: parallel `captionTemplateId` + `captionStyle` fields, dumping resolved style into config

**No-op default / Place seed**:
Same spirit as prototype: omit means identity at props time; place may write on-seeds (e.g. entrance SFX) once.

**Clean break**:
No dual-read of prototype YAML shapes, string edit ids, or `cuts` delete lists.

### Coordinates

**Local timestamp**:
Seconds on a single Asset’s media timeline. Used by Transcript words and by `LocalTime` / `ArollKeep` `{ assetId, start, end }` (asset layer).

**Timeline timestamp**:
Seconds on the expanded editor/config axis: keeps + derived gaps to scale (gaps count as time). Range form: `TimelineTime` `{ start, end }`. Used by all Edits, projected transcript words, and Timeline/Transcript View. Delete/restore does **not** shift later edit timestamps — the gap holds the span; overlapping edits are pruned/clamped only.
_Avoid_: calling this “global” (ambiguous with output); storing a parallel display clock

**Output timestamp**:
Seconds on the compacted playback/export timeline (sum of keep durations in `arolls` order). Range form: `OutputTime` `{ start, end }`. Remotion Player/Lambda only — map from timeline at props/seek time by skipping gaps.
_Avoid_: persisting output times on Edits

**Projection**:
Derive timeline words from `arolls` + per-asset transcripts + asset durations (for gap layout). Do not persist a separate projected transcript. Map timeline → output at the Remotion edge.

### MVC

**Model**:
Pure ProjectConfig (and transcript emphasis) transforms. No Zustand, no Remotion.
_Avoid_: store logic in Model, View writing config

**Controller**:
Zustand actions: call Model, commit, live gestures, undo (full-config snapshots), selection side effects. Debounced autosave to Postgres. Prefer `immer` (`produce`) for nested Snapshot updates (config / transcripts) instead of hand-rolled spreads; Model helpers already follow this.

**View**:
React editor + Remotion player/export. Composes View primitives. Kind modules choose primitives; they do not reimplement range chrome.

### View — transcript primitives

**Transcript marker**, **Handle**, **Highlight**, **Underline**:
Markers show idle; underline + highlight + handles only when the edit is selected. Appearance is kind-specific. Multiple start markers on one word collapse to a primary chip (shared priority with underline: B-roll → VFX → SFX → Zoom; selected wins) plus vertical color dots for the rest; click expands inline to all chips (one cluster open at a time; primary click toggles shut; collapses when selection leaves the cluster). Transcript header toggles (session-only) can hide chrome per kind (B-roll / VFX / SFX / Zoom) without affecting timeline or player.

### View — timeline primitives

**Track**, **Keep/cut cell** (keep vs derived gap), **Edit cell**:
A-roll track shows keep/gap cells from `arolls`. Each Edit gets an Edit cell on its track. Captions bind as a Project-field track when shown.

### View — player primitives

**Text overlay**, **Zoom**, **ScreenShake**, **Media layer**, **Audio layer**:
Shared modules for editor preview (`@remotion/player`) and Lambda export. Consume resolved **ProjectProps**, not sparse omit semantics. `ScreenShake` wraps A-roll/zoom/b-roll; captions and on-screen text stay outside.

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
3. Keep builder (long gaps) → `arolls`
4. AI assist (create + editor **AI** button), on **timeline projected** transcript:
   1. title if empty → `Project.title` + seed `vfx/text`
   2. punch-in zooms
   3. listicles
   4. quotes (key phrases ~3–10 words; first starts at word 0 / hook end by LLM; ≥5 words between; no overlap with listicle; may overlap text/zoom)
   5. emphasis — two LLM passes unioned: sparse over whole script, then denser inside quote ranges
   6. pacing reconcile → yes/no slow zooms on bare sentences (≥5 words, no edits)
   7. companion SFX (role.intensity from AI SFX pack; hash-pick asset from pool; 300ms min-gap; priority reveal/tick → quote ping → punch-in motion; no hook-riser/`build` candidates)
   Editor re-run keeps `arolls`, Project fields, and b-roll edits; replaces other edits + emphasis.
5. Seed default `captions` TemplateStyle → `ready` (create only)


**Export workflow**:
Remotion Lambda; private S3 via IAM (editor uses signed URLs). Output 1080×1920 @ 30fps.

## Relationships

- Project has many Assets; Asset has 0..1 Transcript
- Global Assets have `projectId = null` (seeded SFX); edits reference any Asset by id
- ProjectConfig.arolls reference project video Assets
- Edits use timeline time; arolls use local time; Remotion maps timeline → output
- On-screen title is a `vfx`/`text` Edit (seeded, deletable); `Project.title` is metadata only and is not kept in sync after seed
- Captions are a Project field (`TemplateStyle`); quote VFX overrides caption look over a range at props time
- Quote may overlap text VFX and zoom; quote must not overlap listicle; quotes do not overlap each other
- Companion SFX are sibling `sfx` edits; AI chooses optional `role.intensity` from the AI SFX pack only; concrete Asset is hash-picked from the seeded pool

## Composition matrix (v1)

| Concern | Model | Transcript chrome | Timeline | Player |
|---------|--------|-------------------|----------|--------|
| b-roll | Edit | yes | Edit cell | Media (+ Audio if entrance sfx) |
| sfx | Edit | yes | Edit cell | Audio layer |
| zoom | Edit | yes | Edit cell | Zoom |
| vfx/quote | Edit | yes | Edit cell | Caption style override (+ text as applicable) |
| vfx/text | Edit | yes | Edit cell | Text overlay |
| vfx/listicle | Edit | yes | Edit cell | Listicle overlay (shared `listicleStyle`) |
| vfx/shake | Edit | yes | Edit cell | ScreenShake (wraps A-roll/zoom/b-roll; captions/text outside) |
| captions | Project field | no | optional track | Text overlay (words from projection) |
| arolls | topology | — | Keep/gap cells | A-roll Media |
| emphasis | Transcript word flag | (caption styling) | — | caption word style |

## Deprioritized / out of scope

- Location VFX, cutout greenscreen
- Music (Project field later)
- Listicle/emphasis process flags
- Teams/sharing; user upload to global library
- Per-project dimensions/fps
- Standalone AI SFX (non-companion); AI `texture` SFX roles; SFX on slow zooms / sparse outer emphasis

## Flagged ambiguities

- Exact default duration/range for seeded title `vfx/text`
- ~~Whether b-roll entrance SFX is place-seeded by default~~ → **unset by default**; project field `defaultBRollSfxAssetId` places a sibling `sfx` edit on new b-roll drops (no nesting)
- Poster/thumbnail for projects grid
- ~~Overlapping idle underlines / markers: stack vs priority~~ → **priority** (B-roll → VFX text/quote/listicle/shake → SFX → Zoom; same key → lower `editId`): one primary marker chip + secondary color dots (click expands inline); underline/highlight/handles only when selected (same primary)
- ~~Exact min-gap for companion SFX stacking~~ → **300ms**; priority reveal/tick → quote ping → punch-in motion (pack still has `build` but AI does not candidate it)
- ~~Aggressive quote cadence hard quota vs soft~~ → **key-phrase only** (~3–10 words; first quote from word 0; ≥5 words between — spaced subsets)

