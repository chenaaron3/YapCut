# Add a Job

Host primitives stay at this folder’s root (`job.ts`, `kickoff.ts`, `publish.ts`, `stream.ts`). Do not copy them.

Create and mask use the same filenames:

```
<pipeline>/
  start.ts              # kickoffWorkflow
  run.ts                # in-process runJobs
  publish.ts            # column + bus + NDJSON
  jobs/<job>.ts         # Job adapter (start / poll / finish / fail)
```

Create also has `pipeline.ts` (load A-rolls, Whisper persist, keeps + AI + ready) and `media-progress.ts` (merge WhisperX + fal into one bar).

Mask also has `io.ts` (BiRefNet + Mask row persist). Measure I/O stays in `server/media/` because music/SFX upload uses it too.

`"use step"` wrappers must be **named functions at the call site**. Do not put a step on an object — the isolate then throws `start is not a function`. Workflow files import `job.ts` directly (avoid `kickoff.ts` / `stream.ts` in the isolate).

## New job type on an existing pipeline

**1 new file** + edits: `jobs/<name>.ts`, then wire `run.ts` and `src/workflows/<pipeline>.ts`. Vendor I/O in `io.ts` / `pipeline.ts` / `server/media/` as above. Progress mapping is `falJobProgress` / `replicateJobProgress` plus a tau.

## New pipeline

Same six host files as mask (`start`, `run`, `publish`, `jobs/<job>`, `src/workflows/<name>.ts`, stream route), plus `io.ts` if persist is pipeline-specific. tRPC calls `start.ts`. New progress stages live in domain.
