# Talking Head 2

Domain language for the project editor, create pipeline, Remotion render/export path, and publish schedule. Architecture reviews and refactors should use these terms.

Production rewrite of the `talking-head` prototype: T3 stack, S3 assets, Postgres config/transcripts, multi A-roll, unified edits.

## Language

### Product / persistence

**Project**:
One deliverable video. Owned by at most one User (none until **Claim**). Display name is `Project.title` (DB column — not inside config).
_Avoid_: Episode (prototype term), episode title as config field; requiring a User at create

**Claim**:
Attaching a User to a Project that has none. Required to open the editor or Export. After Claim the Project is owned by that User and the id is no longer enough to open it.
_Avoid_: anonymous / guest / shadow User; treating Claim as merging two Users; a separate unclaimed-access secret; showing an unclaimed Project on `/projects` or in the editor

**ProjectConfig**:
Sparse JSON document on the Project row: topology (`arolls`), flat `edits`, and Project fields (e.g. `captions`). Editor holds an in-memory copy and debounced-autosaves the whole blob.
_Avoid_: config blob (prefer ProjectConfig), row-per-edit, parallel kind arrays (`bRolls` / `vfx` / …)

**Project field**:
Project-level config data that is not an Edit and has no EditId. Today: `captions` (`TemplateStyle`), `emphasisStyle`, `listicleStyle` (SoT for listicle look — denormalized onto each listicle Edit’s `style`), `defaultBRollSfxAssetId` (global audio Asset id or null — place-time sibling `sfx` edit when dropping b-roll), `music` (`MusicBed` or null — one looping bed for the output). Title string is a Project column, not a Project field.
_Avoid_: treating captions/music as Edits; nesting entrance SFX on `BrollEdit`; treating on-screen title overlay as the Project.title column; reading `listicleStyle` at paint time instead of the edit’s mirrored `style`

**Music bed** (`MusicBed`):
Project field: one looping audio Asset for the whole output. `MusicBed` is a `MediaRef` (`assetId`, `volume`, `mediaOffsetSec`) — same media fields as `sfx` / `broll`, but not an Edit (no EditId, no timeline range; loops the whole output). Null when unset. Pick / inspect from the Music tab (no timeline track). Playback applies library LUFS gain × mix, plus edge fades — no ducking under voice/SFX.
_Avoid_: music as an Edit; a music timeline track; audio ducking; treating project-uploaded music as SFX

**Asset**:
Media object in private S3. `kind: "video" | "image" | "audio"`. `projectId` set ⇒ project-scoped; `projectId` null ⇒ **global** library (SFX pack under `global/sfx/`, music under `global/music/`). Create-flow uploads are project-scoped A-roll videos only. Create and music upload **require** measured `lufs` / `truePeakDb` (fal `ffmpeg-api/loudnorm` over a signed CloudFront URL). A-roll video also stores a peak `waveform` (`ffmpeg-api/waveform`) for the timeline VoiceBand. `npm run seed:global` is idempotent: upserts the global SFX/music libraries.
_Avoid_: is_visual / is_audio booleans, public URLs as source of truth

**Transcript**:
Word-level transcription for one Asset (0..1). Stored as JSONB `words[]` (local timestamps on that asset) plus duration/status. Emphasis is an optional boolean on a word (`emphasized`), not sentiment. Same flag everywhere: two AI passes unioned — sparse across the whole script, then denser (most content words) inside each quote punch phrase. Look is an `EmphasisStyle` treatment layered on the current group style (caption, or caption→quote): scale × group size, fill, optional font. Project field `emphasisStyle` is the base; `VfxQuoteEdit.emphasisStyle` sparse-merges on top. Layout (y / words-per-group) always follows the surrounding group. Optional **scribble** is a sibling word field, not part of `EmphasisStyle`.
_Avoid_: normalized word rows, global persisted transcript copy, positive/negative emphasis, a second “quote emphasis” type, null inherit-group sentinels, emphasis owning y or captionsAtATime, scribble on `EmphasisStyle`

**Scribble**:
Optional draw-on mark on a Transcript word (`scribble`), sibling of `emphasized`. Catalog: `double-underline` / `wavy-underline` / `double-circle` / `corner-box` / `bubble` / `highlight` / `strike-through`. Omit = none. Only paints when the word is `emphasized`. Word-level inspector (not Captions/Quote emphasis). Arc captions skip scribble (no whole-word box). Path data adapted from the Cheez library — Cheez is not a product term.
_Avoid_: Cheez as a glossary/API name; scribble as a VFX/edit kind; scribble as a second emphasis type; project/quote default scribble

**Aroll keep** (`ArollKeep`):
One segment to keep from an A-roll asset: `{ id, assetId, start, end }` in **local** asset time. `id` is a monotonic integer (`max(ids)+1`, never reused, never renumbered on insert) — identity for transitions. `ProjectConfig.arolls` is a flat ordered list; array order is stitch order on the timeline / output. Keeps for the same asset are **contiguous** in that list (no interleaving another asset between two keeps of one asset — you cannot cut part of a clip and place it after a different asset). Keep surgery emits generic `ArollKeepOp` (`split` / `merge` / `remove`); edit kinds that bind to keep ids register an `ArollEditPostprocessor` (transitions today) — arolls do not import those kinds.
_Avoid_: Cut (prototype delete-range), storing keep lists grouped by asset as source of truth, parallel delete array, A→B→A stitch order, using array index or layout-cell index as keep identity

**Speech cleanup**:
Create-only AI pass after the keep builder: cut vocalized pauses (`um` / `uh` / `er` / `ah` / …) and retakes (false starts, restated takes — keep the successful take). Same keep surgery as a manual word delete (gap cells remain). Soft-fail. Editor **AI** re-run does not re-cut.
_Avoid_: deterministic filler cuts in the keep builder; cutting discourse “like” / “you know” unless empty; running on editor re-run

**Deleted / gap cell**:
Timeline View chrome for media not in `arolls` (between keeps or trimmed ends). Derived in the View — never stored as topology.
_Avoid_: Cut as persisted model type

### Model (ProjectConfig)

**Edit**:
A ranged overlay on the **timeline** (expanded; gaps count). Flat `edits[]` with one discriminant `kind`. Mutated through shared Model CRUD.
_Avoid_: clip (ambiguous), local-time edits, output-time edits, kind+type nesting except `vfx.type`; treating Transition as VFX; treating sticker as b-roll or a VFX subtype

**EditId**:
Monotonic integer identifying an Edit. Assigned at place as `max(ids)+1`; never reused after delete.
_Avoid_: uuid, array index, string ids

**Edit kinds (v1)**:

```
broll | sticker | sfx | zoom | vfx | transition
```

- **zoom** — end-keyframe `Transform` + optional `ease` (omit/false = hard **punch-in**; true = **slow zoom** ease identity → end over the range)
- **vfx** — `type: "quote" | "text" | "listicle" | "shake" | "motion"` (location/cutout out of scope)
- **sticker** — catalog overlay (`source: "emoji" | "lordicon"` + `catalogId`). Same Edit shape; `source` is playback (`loop` vs intro-then-hold), not a second kind. Fixed ~180px box + `Transform`. No Ken Burns, no Asset row. Catalog files live under `public/stickers/{source}/{topic}/`. Emoji: Noto top 250 by popularity, Unicode group as topic (skip Animals & Nature and Flags), plus 15 food/drink. Lordicon: Wired Flat Popular + original Marks + talking-head extras; topic is a collapsed Lordicon category (`ui` / `people` / `media` / `business` / `tech` / `objects`). Drag from Stickers (Popular / Emoji / Marks / All + search). Place range is the drop word. Editor AI re-run drops stickers (keeps b-roll).
- **transition** — A-roll picture stitch (`templateId: "flash" | "fade" | "slide"`). Identity is `stitch` + `durationSec`; one per keep–keep stitch (plus opening and closing). Not a VFX subtype, not a sting.

**Transition**:
An Edit at an A-roll stitch: `{ id, start, end, kind: "transition", templateId, durationSec, stitch }`. Identity is `stitch` + `durationSec` (output seconds); `{start,end}` is derived timeline range (gaps count). `stitch` is `{ kind: "opening" }` / `{ kind: "closing" }` (sequence roles — always the current first/last keep) or `{ kind: "interior", outKeepId, inKeepId }`. Interior `{start,end}` bridges exactly one gap. Opening: **in only** from black, left edge pinned to first keep start. Closing: **out only** to black, right edge pinned to last keep end. Resize is symmetric in output seconds (grow/shrink both keeps equally; growing does not eat the gap). Cannot exist mid-keep; cannot drag-move off the junction. Drop on a filled stitch **replaces** `templateId` (no stack). Create seeds opening+closing as a mirrored **flash** pair (same duration); they are not kept in sync after that. Seed template is **flash**. No Project-level default / no fan-out. Keep surgery retargets interiors (split: outgoing follows the right fragment; merge: dying id → left survivor, self-stitch dropped; remove keep: drop refs). Trim and unrelated cell edits do not drop a transition.
_Avoid_: sting; Cut as persisted type; persisting OutputTime on the Edit; `vfx` subtype for this; mid-keep transitions; stacking two on one stitch; classifying identity from `{start,end}`; attaching to derived layout-cell / gap ids; special-casing place in the store — build stitch + durationSec on the drop caller

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
An `sfx` Edit placed beside an eligible visual moment (punch-in, quote peak, listicle heading/subheading, title card). Optional per candidate (`none` allowed). Not used to plug pacing gaps. AI does not place riser companions.
_Avoid_: nesting SFX on zoom/vfx; free-placement SFX as gap filler; SFX on sparse outer emphasis; SFX on slow zooms

**AI SFX pack**:
Curated role pools for create AI only. Roles: `reveal` (title + listicle heading), `tick` (listicle subheading), `ping` (quote peak), `motion` (punch-in). LLM picks intensity (`soft`/`medium`/`hard`) or `none` for a fixed candidate role; place-time hash picks one Asset from `public/sfx/<role>/`. Intensity sets volume only. `custom/memes/` and `custom/riser/` are manual library only (SFX tab).
_Avoid_: letting the LLM choose from the entire global library; `texture` roles (typing/flash); meme/riser in AI pool; hardcoding asset UUIDs in the pack; nesting separate sound pools under intensity folders

**Beat**:
A visible or audible onset that resets pacing: punch-in start, quote start, listicle heading start and subheading middle (when staggered), emphasized word start, seeded title `vfx/text` start. Target: about one beat every ~3s of keep/output time (~2s in the **hook**).
_Avoid_: counting only edits (emphasis counts); using SFX to satisfy the floor; measuring across deleted gap cells

**Hook**:
Opening ~10s of keep/output time; heavier editing (tighter beat target, bias toward early punch-in and/or quote).
_Avoid_: undefined “intro”; applying hook density to the whole video

**Pacing reconcile**:
Create AI pass after visual set pieces + emphasis: code lists bare sentences (≥5 words, no overlapping edits); LLM returns yes/no per sentence; yes → slow zoom over the full sentence.
_Avoid_: early zoom step owning slow fillers; gap-index / partial-phrase slow zooms; reconcile inventing standalone SFX

**TemplateStyle**:
`{ templateId, overrides?, subheadingOverrides? }` — catalog base + sparse user overrides. `overrides` is the look for captions/quotes, and the heading bag for title/listicle overlays. `subheadingOverrides` is the overlay subheading bag (captions/quotes ignore it). Used by Project fields `captions` / `listicleStyle` and by `vfx` quote / TextBase (`style`). Resolve at props time; do not persist fully resolved style.
_Avoid_: parallel `captionTemplateId` + `captionStyle` fields, dumping resolved style into config, `headingOverrides` (reuse `overrides`)

**TextBase**:
Shared mixin on title (`vfx/text`) and listicle (`vfx/listicle`): `Transform` (block pose) + `heading` / `subheading` (empty subheading = heading only) + `middle` (null = no split) + `hideCaptions` (seed true for both) + `style` (`TemplateStyle`). Title owns its look per-edit. Listicle look is Project field `listicleStyle` as source of truth — denormalized onto each listicle’s `style` at place/AI seed and fanned out on every global patch. One overlay catalog (`stacked` lives on the template, not the edit). Serial templates always stagger (virtual midpoint if `middle` is unset; persist on handle drag or picking a serial template). Stacked + stagger off = both lines from t=start.
_Avoid_: overlay `style.y` as block position; reading Project.`listicleStyle` at paint/resolve time (use the edit’s `style`)

**Motion Edit** (`vfx/motion`):
Word-synced graphic overlay. Persisted document is a **ShotPlan** (Director form, discriminated by `category`) plus a caption-catalog **TemplateStyle** on the Edit. Inspector Generate sends a prompt (+ current `plan` when revising) — prompt is request-only, not stored on the Edit. Director is one chat: optional `source_still` tool (search/generate into project Assets) then a ShotPlan. Builder is a Remotion catalog: `stat` / `charts` / `lower-thirds` (`name-bar` | `chip`) / `news` / `asset-fusion` / `checklist`. Look comes from `TemplateStyle` (`overrides.fill` is the accent). Extra overlay duration holds the last authored frame.
_Avoid_: LLM-written Remotion/GSAP/HTML; Score/Draft/layout trees; `wordIndex` clocks; treating quote/title as kinetic motion; a second paint path; persisting prompt/thread; duplicating `vfx/listicle` as Motion (checklist is one accumulating stack, not one card per item)

**ShotPlan**:
The Motion Edit’s category form. Director fills it; painters mux on `category`. Image slots are `MediaRef` (same pointer as b-roll). Place seed is `plan: null`. `checklist` is `headline` + `items[{ label, atSec }]` — `atSec` is seconds from overlay start (copied from numbered words). Rows persist; extra overlay time holds the last item.
_Avoid_: persisting `wordIndex`; a parallel ShotAsset type; `recipeId` as a second document

**No-op default / Place seed**:
Same spirit as prototype: omit means identity at props time; place may write on-seeds (e.g. entrance SFX) once.

**Clean break**:
No dual-read of prototype YAML shapes, string edit ids, or `cuts` delete lists.

### Publish / schedule

**ScheduleEntry**:
One Project slotted for platform publish. Created by an explicit app “Add to schedule” action (not by export, not by the CLI). Requires the Project to be `ready` with both export video and **Cover** keys present. Creating the entry sets Project status to `scheduled`. Owns the publish slot (`scheduledAt`), assigned once at Add from cadence and not changed afterward. At most one per Project (v1). Does not snapshot title or media — those are read live from the Project at publish time. Platform outcomes live on child **PlatformPublish** rows. Once created, not deleted or rescheduled.
_Avoid_: Manifest / ManifestEntry as the persisted document; Episode; stuffing publish URLs onto the Project row; republish history as extra ScheduleEntries; auto-queue on export; CLI creating queue rows; freezing export keys onto the entry; removing or rescheduling ScheduleEntries; queuing without Cover

**PlatformPublish**:
Current publish state for one platform on one ScheduleEntry (unique per entry+platform). Seeded as `pending` for each platform in **ScheduleSettings** when the entry is added. Transitions: `pending` | `failed` → `uploading` → `succeeded` (post URL) | `failed` (last error). Retry skips `succeeded`. No attempt history in v1.
_Avoid_: nullable URL fields on ScheduleEntry as the only signal; append-only attempt rows; treating “has URL” as the sole state machine; modeling platform-native “scheduled vs live” beyond the returned URL

**Cover**:
Styled still for platform thumbnails: first keep frame of the export plus large centered title treatment (prototype look — uppercase yellow title, heavy black stroke). First-class Project export artifact persisted like the video (`coverS3Key` on Project, not an Asset). Required input to **Publisher**. Title text on the still is whatever `Project.title` was at export time; rename after export without re-export is an accepted mismatch vs live upload title.
_Avoid_: auto-thumb only; ad-hoc ffmpeg first-frame without title styling; local-only `cover.jpg`; Cover as library Asset; deriving cover only at schedule time; blocking publish on title/Cover drift

**Platform**:
A distribution destination for a ScheduleEntry’s export (v1: youtube, instagram, tiktok).
_Avoid_: channel, network (ambiguous)

**Publisher**:
Port that posts one Platform’s media for a ScheduleEntry and returns the resulting post URL (or fails). Orchestration (cadence, ScheduleEntry / PlatformPublish updates) stays outside the Publisher. Inputs are title, publish slot, and opaque media refs for the export (and cover when required) — not local filesystem paths. v1 implementations run in the local schedule CLI.
_Avoid_: baking Playwright/API details into the schedule domain; path-based schedule inputs; swapping the whole run/DB loop just to change how uploads happen; running Playwright Publishers on Vercel

**ScheduleSettings**:
Per-user publish cadence and platform list (daily slot time, timezone, ordered platforms). Source of truth in the DB so the app and CLI share one config. Changing platforms/cadence affects **new** ScheduleEntries only — already-queued PlatformPublish rows are not rewritten.
_Avoid_: schedule.config.yaml as source of truth; env-only cadence; stuffing cadence onto ScheduleEntry; auto-reconciling old entries when settings change

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
Derive timeline words from `arolls` + per-asset transcripts + asset durations (for gap layout). Do not persist a separate projected transcript. Map timeline → output at the Remotion edge. Clock conversion, clamp, and snap live in `src/domain/aroll/layout-time.ts`; layout construction and keep lookups stay in `arolls.ts`.

**Caption / quote Y**:
`CaptionGroupStyle.y` for captions and quotes is −1…1 in the **safe area**. `0` = middle, `1` = bottom, `−1` = top. Positive is down.

**Overlay place**:
Title/listicle **block** pose is `Transform` on `TextBase` (same as b-roll: composition-center origin, positive `offsetY` = down). Seed `offsetY` in the upper title band, not frame center. Each line’s `style.y` is a translate of **that line’s own height** (`±1` = ±100% of that element) — close an arc hollow by moving heading down and subheading up.
_Avoid_: overlay `overrides.y` as block position

### MVC

**Model**:
Pure ProjectConfig (and transcript emphasis) transforms. No Zustand, no Remotion.
_Avoid_: store logic in Model, View writing config

**Controller**:
Zustand actions: call Model, commit, live gestures (`beginGesture`/`endGesture`; live commits skip tRPC until end), undo (full-config snapshots), selection side effects. Debounced autosave to Postgres. Prefer `immer` (`produce`) for nested Snapshot updates (config / transcripts) instead of hand-rolled spreads; Model helpers already follow this.

**View**:
React editor + Remotion player/export. Composes View primitives. Kind modules choose primitives; they do not reimplement range chrome.

### View — transcript primitives

**Transcript marker**, **Handle**, **Highlight**, **Underline**:
Markers show idle; underline + highlight + handles only when the edit is selected. Appearance is kind-specific. Multiple start markers on one word collapse to a primary chip (shared priority with underline: B-roll → Sticker → VFX → SFX → Zoom → Transition; selected wins) plus vertical color dots for the rest; click expands inline to all chips (one cluster open at a time; primary click toggles shut; collapses when selection leaves the cluster). Transcript header toggles (session-only) can hide chrome per kind (B-roll / Sticker / VFX / SFX / Zoom / Transition) without affecting timeline or player. **Transition** is marker-only (cannot move; no RangeHandle). Valid drop words are keep-edge punctuated sentence starts (`.?!` only, including in-gap words) plus opening keep and closing after the last kept word. While a Transitions-tab drag is in flight, every valid word shows a gentle blue glow; illegal spots stay unmarked.

### View — timeline primitives

**Track**, **Keep/cut cell** (keep vs derived gap), **Edit cell**:
A-roll track shows keep/gap cells from `arolls`. Each Edit gets an Edit cell on its track (except **Transition** — thin gutter above Video, not a full-height keep bar and not a VFX-track clip). Captions bind as a Project-field track when shown. Idle transition chrome is a bowtie/diamond centered on the gap (hairline across long gaps); selected shows wings into adjacent keeps with CapCut-style tip handles. Duration via inspector slider and those wing handles (no caption/word snap).

### View — player primitives

**Text overlay**, **Zoom**, **ScreenShake**, **Media layer**, **Audio layer**, **Transition**:
Shared modules for editor preview (`@remotion/player`) and Lambda export. Consume resolved **ProjectProps**, not sparse omit semantics. `ScreenShake` wraps A-roll/zoom/b-roll; captions and on-screen text stay outside. Stack: A-roll → zoom → b-roll → **transition** → text overlays (title/listicle/quote + **motion** + **sticker**) → captions. Fade/slide need both keep pictures at the stitch (overlap). Flash is a short full-frame white pulse on the picture (after A-roll+b-roll+zoom, under title/listicle/captions) — do not cover headings.

**ProjectProps**:
Fully resolved render DTO (defaults materialized). Built from ProjectConfig + assets + projected transcripts.

## Status

Single mega-status on Project:

| Status       | Meaning                                |
| ------------ | -------------------------------------- |
| `processing` | Create workflow running                |
| `ready`      | Editable; may have prior `exportS3Key` |
| `scheduled`  | Slotted for publish; still editable    |
| `exporting`  | Lambda render in flight                |
| `failed`     | Create failed (editor not openable)    |

Transitions: `processing → ready | failed`; `ready → scheduled` on **Add to schedule** (stays `scheduled` forever — the **ScheduleEntry** is permanent); `ready | scheduled → exporting`; `exporting → ready | scheduled` (restore `scheduled` if the Project has a ScheduleEntry). Set `exportS3Key` on export success; set `failureReason` on export failure and return to the idle status. Create failure uses `failed` + `failureReason`. Publish outcomes stay on **PlatformPublish** — they are not Project statuses.

Export is a snapshot at click; editing during `exporting` is allowed. Only one export at a time.

## Pipelines

**Create workflow** (Vercel Workflows):

1. Presigned upload → Project + Assets (`processing`). May start with no User from the landing drop (one A-roll). Signed-in create is unchanged (multi-clip).
2. WhisperX and fal measure in parallel per A-roll (enqueue all, poll; create fails if either fails). WhisperX: language autodetect, diarization off → Transcript rows. Measure: LUFS + true peak + waveform via fal ffmpeg-api.
3. Keep builder (long gaps) → `arolls`
4. AI assist (create + editor **AI** button), on **timeline projected** transcript (kept words only):
   1. **speech cleanup** (create only) — vocalized-pause sweep + LLM retakes/false starts; keep surgery like a manual word delete (gap cells remain). Soft-fail. Editor re-run skips this.
   2. title if empty → `Project.title` + seed `vfx/text`
   3. punch-in zooms
   4. listicles
   5. transitions — code seeds opening+closing as a mirrored **flash** pair (same duration); code seeds a transition on any listicle heading whose start sits on a valid drop word (keep-edge punctuated sentence; mid-keep listicles get none); LLM yes/no on remaining interior valid junctions (soft-fail). No companion SFX role for transitions (existing reveal SFX on title/listicle unchanged).
   6. quotes (key phrases ~3–10 words; first starts at word 0 / hook end by LLM; ≥5 words between; no overlap with listicle; may overlap text/zoom)
   7. emphasis — two LLM passes unioned: sparse over whole script, then denser inside quote ranges
   8. pacing reconcile → yes/no slow zooms on bare sentences (≥5 words, no edits)
   9. companion SFX (intensity soft/medium/hard/none for fixed role; hash-pick asset from `sfx/<role>/` pool; 300ms min-gap; priority reveal/tick → quote ping → punch-in motion; no riser candidates)
      Editor re-run keeps `arolls`, Project fields, and b-roll edits; replaces other edits + emphasis.
5. Seed default `captions` TemplateStyle → `ready` (create only)

**Export workflow**:
Remotion Lambda; private S3 via IAM (editor uses signed URLs). Output 1080×1920 @ 30fps. On success writes video export key and **Cover** key on the Project.

**Schedule run** (v1):
Uploads/retries incomplete **PlatformPublish** rows for due **ScheduleEntry**s (`scheduledAt ≤ now`, oldest first). Triggers: local app **Add to schedule** (background, that Project, skips due filter) and the local CLI (`--project`; `--force` ignores the due filter). Downloads live Project export + **Cover**, invokes **Publisher**s, updates status. Reads **ScheduleSettings** from DB. Does not create queue rows. Not on Vercel.

## Relationships

- A **Project** is owned by 0..1 User; **Claim** attaches a User to an unclaimed Project
- Until **Claim**, knowing a Project’s id is enough to load it; after Claim only the owning User may
- An unclaimed Project is created and watched only on the landing page (create progress, then a watch-only player). The editor and project list require a User
- The landing page restores the current unclaimed Project across refresh and later visits (progress or player)
- Landing accepts only one unclaimed Project at a time; `processing` and `ready` stay on landing until **Claim** (no second drop). `failed` shows the error and a new drop discards it
- Any Google sign-in from landing **Claim**s the current unclaimed Project if one exists, then opens the editor. No landing Project → project list
- Landing unclaimed create is one A-roll, 250 MB max; signed-in create keeps the existing multi-clip limits
- Project has many Assets; Asset has 0..1 Transcript
- Global Assets have `projectId = null` (seeded SFX under `global/sfx/`, music under `global/music/`); edits and `music` reference any Asset by id
- ProjectConfig.arolls reference project video Assets
- `music` is a Project field (one looping bed or null); project-scoped audio uploads are music, not SFX
- Edits use timeline time; arolls use local time; Remotion maps timeline → output
- On-screen title is a `vfx`/`text` Edit (seeded, deletable) sharing `TextBase` with listicle (heading/subheading/`middle`/hideCaptions/`Transform`/`style`); `Project.title` is metadata only and is not kept in sync after seed
- Captions are a Project field (`TemplateStyle`); quote VFX overrides caption look over a range at props time
- Emphasis look is a Project field (`emphasisStyle`); quote may sparse-merge the same `EmphasisStyle` shape on top; AI never writes emphasis style
- Scribble is a Transcript word field (sibling of `emphasized`); AI never writes scribble; paint only when the word is emphasized
- Quote may overlap text VFX and zoom; quote must not overlap listicle; quotes do not overlap each other
- Title and listicle share one overlay catalog and one paint path; both carry `TextBase.style`; listicle’s copy mirrors Project `listicleStyle` (fan-out on patch)
- Companion SFX are sibling `sfx` edits; AI chooses optional intensity (`soft`/`medium`/`hard`) for a fixed candidate role from the AI SFX pack only; concrete Asset is hash-picked from the seeded role pool; intensity sets volume
- A **Transition** Edit is one-per keep–keep stitch (plus opening/closing); identity is `stitch` + `durationSec`; derived `{start,end}` spans the gap; not a VFX subtype and not a companion SFX candidate
- A **Project** has at most one **ScheduleEntry** (v1 strict 1:1); publish media is always the Project’s **current** title, export video key, and **Cover** key (nothing frozen onto the entry except the slot)
- A **ScheduleEntry** has many **PlatformPublish** rows — at most one current row per platform (no attempt history in v1)
- **Publisher** consumes opaque refs to that export video + Cover (not local filesystem paths)
- A user has one **ScheduleSettings**; cadence for new **ScheduleEntry** slots is derived from those settings plus existing entries’ `scheduledAt`

## Composition matrix (v1)

| Concern      | Model                                                             | Transcript chrome | Timeline       | Player                                                        |
| ------------ | ----------------------------------------------------------------- | ----------------- | -------------- | ------------------------------------------------------------- |
| b-roll       | Edit                                                              | yes               | Edit cell      | Media (+ Audio if entrance sfx)                               |
| sfx          | Edit                                                              | yes               | Edit cell      | Audio layer                                                   |
| zoom         | Edit                                                              | yes               | Edit cell      | Zoom                                                          |
| vfx/quote    | Edit                                                              | yes               | Edit cell      | Caption style override (+ text as applicable)                 |
| vfx/text     | Edit                                                              | yes               | Edit cell      | Overlay (`TextBase`, per-edit `style`)                        |
| vfx/listicle | Edit                                                              | yes               | Edit cell      | Overlay (`TextBase`, `style` mirrored from `listicleStyle`)   |
| vfx/shake    | Edit                                                              | yes               | Edit cell      | ScreenShake (wraps A-roll/zoom/b-roll; captions/text outside) |
| vfx/motion   | Edit (`plan`: ShotPlan, `style`: caption TemplateStyle)           | yes               | Edit cell      | MotionLayer → category painter                                |
| captions     | Project field                                                     | no                | optional track | Text overlay (words from projection)                          |
| music        | Project field                                                     | no                | —              | Audio layer (looping bed, edge fades, no ducking)             |
| transition   | Edit                                                              | marker only       | Video gutter   | Picture stitch (fade/slide overlap; flash pulse under text)   |
| arolls       | topology                                                          | —                 | Keep/gap cells | A-roll Media                                                  |
| emphasis     | Transcript word flag + Project `emphasisStyle` (+ quote override) | (caption styling) | —              | caption word style                                            |
| scribble     | Transcript word field (`scribble`); paints only if `emphasized`   | word inspector    | —              | caption word draw-on mark                                     |

## Deprioritized / out of scope

- Location VFX, cutout greenscreen
- Listicle/emphasis process flags
- Teams/sharing; user upload to global library
- Per-project dimensions/fps
- Standalone AI SFX (non-companion); AI `texture` SFX roles; SFX on slow zooms / sparse outer emphasis

## Flagged ambiguities

- Exact default duration/range for seeded title `vfx/text`
- ~~When **ScheduleEntry** is created (export time vs first schedule CLI run)~~ → explicit app **Add to schedule**; CLI only uploads/retries queued entries
- ~~Whether title / media refs are frozen on **ScheduleEntry** at queue time vs always read live from Project~~ → **live from Project** (title, export, Cover); entry stores slot + platform state only
- ~~**PlatformPublish** status set / when rows are seeded~~ → seeded `pending` from **ScheduleSettings.platforms** at Add; `pending|failed` → `uploading` → `succeeded`|`failed`
- ~~If **ScheduleSettings** platforms change after entries are queued~~ → settings apply to **new** entries only; existing PlatformPublish rows unchanged
- ~~Remove / reschedule a **ScheduleEntry**~~ → **no remove, no reschedule** — slot is fixed at Add; entries are permanent
- ~~Add-to-schedule prerequisites (export + Cover required?)~~ → require export video + **Cover** keys (Project `ready`); Add sets Project to `scheduled`
- ~~v1 UI surface (settings + queue + add)~~ → ScheduleSettings + queue list + Add (no remove/reschedule/calendar)
- ~~CLI invocation shape (all incomplete vs per-project)~~ → due incomplete by default (`scheduledAt ≤ now`); `--project`; `--force` for early upload; local **Add to schedule** starts the same run in the background with `--force` for that Project
- ~~Cover still shows title baked at export while Publisher caption/title uses live `Project.title` if renamed after export~~ → **acceptable**; re-export if thumb text must match

## Example dialogue

> **Dev:** "After export, do I run schedule to create the manifest row?"
> **Domain expert:** "No — **Add to schedule** in the app creates the **ScheduleEntry** and seeds **PlatformPublish** rows. Locally that also starts the upload run in the background. The CLI retries due incomplete platforms."
>
> **Dev:** "If I re-export before the CLI runs, which video goes out?"
> **Domain expert:** "The live Project export and **Cover** — nothing is frozen on the entry except `scheduledAt`."
>
> **Dev:** "Can I delete a ScheduleEntry after YouTube succeeded but TikTok failed?"
> **Domain expert:** "You can’t delete ScheduleEntries at all — the queue is history. Retry TikTok."
>
> **Dev:** "Does dropping a video on landing create a User?"
> **Domain expert:** "No. That’s an unclaimed **Project**. **Claim** happens when they sign in — then they can open the editor or Export."

- ~~Whether b-roll entrance SFX is place-seeded by default~~ → **unset by default**; project field `defaultBRollSfxAssetId` places a sibling `sfx` edit on new b-roll drops (no nesting)
- Poster/thumbnail for projects grid (may reuse **Cover**)
- ~~whether schedule **Publisher**s require a separate cover Asset vs frame-from-export~~ → **Cover** is a first-class styled Project output (prototype title-on-first-frame look), required for Publisher
- ~~Overlapping idle underlines / markers: stack vs priority~~ → **priority** (B-roll → VFX text/quote/listicle/shake/motion → SFX → Zoom → Transition; same key → lower `editId`): one primary marker chip + secondary color dots (click expands inline); underline/highlight/handles only when selected (same primary). Transition has no handles.
- ~~Exact min-gap for companion SFX stacking~~ → **300ms**; priority reveal/tick → quote ping → punch-in motion (risers are manual library only)
- ~~Aggressive quote cadence hard quota vs soft~~ → **key-phrase only** (~3–10 words; first quote from word 0; ≥5 words between — spaced subsets)
