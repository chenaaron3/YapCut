/**
 * Vercel Workflow definition for project create.
 * Started when `USE_VERCEL_WORKFLOW=true` (see `startCreatePipeline`).
 *
 * WhisperX and fal measure enqueue in parallel, then the shared Job runner
 * polls each job type across short steps with `sleep()`.
 *
 * Node I/O (postgres, fal, Replicate) is loaded only inside `"use step"`
 * functions so the workflow isolate stays sandbox-safe.
 *
 * @see https://workflow-sdk.dev/docs/getting-started/next
 */
import { sleep } from "workflow";

import { createMediaProgressGate, settleMediaJobs } from "~/server/workflow/create/media-progress";
import { rethrowAsFatal, rethrowFatalFal } from "~/server/workflow/fatal";
import { runJobs } from "~/server/workflow/job";

import type { CreateProgressEvent } from "~/domain/project/create-progress";
import type { CreateAssetRef } from "~/server/workflow/create/pipeline";
import type { MeasureHandle } from "~/server/workflow/create/jobs/measure";
import type { WhisperXHandle } from "~/server/workflow/create/jobs/whisperx";
import type { Job } from "~/server/workflow/job";

/** Suspend between Replicate polls (no compute while sleeping). */
const WHISPERX_POLL_SLEEP = "15s";
/** ~30 minutes of wall time for the whole transcribe stage. */
const WHISPERX_MAX_POLLS = 120;
/** Suspend between fal loudnorm/waveform polls. */
const FAL_POLL_SLEEP = "5s";
/** ~10 minutes of wall time for the whole measure stage. */
const FAL_MAX_POLLS = 120;

export async function createProjectWorkflow(projectId: string) {
  "use workflow";

  // `"use step"` fns are only callable at a direct call site. Storing them on
  // an object (`{ start: startWhisperXStep }`) leaves a non-callable step id
  // — production then throws `job.start is not a function`.
  const whisperXWorkflowJob: Job<WhisperXHandle, CreateAssetRef> = {
    name: "WhisperX",
    start: (asset) => startWhisperXStep(asset),
    poll: (jobs) => pollWhisperXBatchStep(jobs),
    finish: (asset, handle) => finishWhisperXStep(asset, handle),
    fail: (asset, reason) => failWhisperXStep(asset, reason),
  };
  const measureWorkflowJob: Job<MeasureHandle, CreateAssetRef> = {
    name: "fal measure",
    start: (asset) => startMeasureStep(asset),
    poll: (jobs) => pollMeasureBatchStep(jobs),
    finish: (asset, handle) => finishMeasureStep(asset, handle),
  };

  try {
    const assets = await loadAssetsStep(projectId);
    const cancel = { cancelled: false };
    const gate = createMediaProgressGate({
      publish: (event) => emitProgressStep(projectId, event),
      cancel,
    });
    await settleMediaJobs(
      runJobs({
        job: whisperXWorkflowJob,
        items: assets,
        maxPolls: WHISPERX_MAX_POLLS,
        sleep: () => sleep(WHISPERX_POLL_SLEEP),
        onProgress: gate.onTranscribe,
        cancel,
      }),
      runJobs({
        job: measureWorkflowJob,
        items: assets,
        maxPolls: FAL_MAX_POLLS,
        sleep: () => sleep(FAL_POLL_SLEEP),
        onProgress: gate.onMeasure,
        cancel,
      }),
    );
    await finalizeStep(projectId);
  } catch (error) {
    await markFailedStep(
      projectId,
      error instanceof Error ? error.message : "Create workflow failed",
    );
    rethrowAsFatal(error, "Create workflow failed");
  }
}

async function emitProgressStep(
  projectId: string,
  event: CreateProgressEvent,
): Promise<void> {
  "use step";
  const { publishCreateProgress } = await import(
    "~/server/workflow/create/publish"
  );
  await publishCreateProgress(projectId, event);
}

async function loadAssetsStep(projectId: string): Promise<CreateAssetRef[]> {
  "use step";
  const { loadCreateAssets } = await import("~/server/workflow/create/pipeline");
  return loadCreateAssets(projectId);
}

async function startWhisperXStep(asset: CreateAssetRef) {
  "use step";
  const { whisperXJob } = await import("~/server/workflow/create/jobs/whisperx");
  return whisperXJob.start(asset);
}

async function pollWhisperXBatchStep(
  jobs: Array<{ index: number; handle: WhisperXHandle }>,
) {
  "use step";
  const { whisperXJob } = await import("~/server/workflow/create/jobs/whisperx");
  return whisperXJob.poll(jobs);
}

async function finishWhisperXStep(
  asset: CreateAssetRef,
  handle: WhisperXHandle,
) {
  "use step";
  const { whisperXJob } = await import("~/server/workflow/create/jobs/whisperx");
  await whisperXJob.finish(asset, handle);
}

async function failWhisperXStep(asset: CreateAssetRef, reason: string) {
  "use step";
  const { whisperXJob } = await import("~/server/workflow/create/jobs/whisperx");
  await whisperXJob.fail(asset, reason);
}

async function startMeasureStep(asset: CreateAssetRef) {
  "use step";
  const { measureJob } = await import("~/server/workflow/create/jobs/measure");
  try {
    return await measureJob.start(asset);
  } catch (error) {
    rethrowFatalFal(error);
  }
}

async function pollMeasureBatchStep(
  jobs: Array<{ index: number; handle: MeasureHandle }>,
) {
  "use step";
  const { measureJob } = await import("~/server/workflow/create/jobs/measure");
  try {
    return await measureJob.poll(jobs);
  } catch (error) {
    rethrowFatalFal(error);
  }
}

async function finishMeasureStep(asset: CreateAssetRef, handle: MeasureHandle) {
  "use step";
  const { measureJob } = await import("~/server/workflow/create/jobs/measure");
  try {
    await measureJob.finish(asset, handle);
  } catch (error) {
    rethrowFatalFal(error);
  }
}

async function finalizeStep(projectId: string): Promise<void> {
  "use step";
  const { finalizeCreateProject } = await import(
    "~/server/workflow/create/pipeline"
  );
  await finalizeCreateProject(projectId);
}

async function markFailedStep(
  projectId: string,
  reason: string,
): Promise<void> {
  "use step";
  const { markCreateFailed } = await import("~/server/workflow/create/pipeline");
  await markCreateFailed(projectId, reason);
}
