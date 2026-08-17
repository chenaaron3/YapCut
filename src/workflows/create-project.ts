/**
 * Vercel Workflow definition for project create.
 * Started when `USE_VERCEL_WORKFLOW=true` (see `startCreatePipeline`).
 *
 * WhisperX and fal measure enqueue in parallel, then the shared runner polls
 * each job type across short steps with `sleep()`.
 *
 * @see https://workflow-sdk.dev/docs/getting-started/next
 */
import { FatalError, sleep } from "workflow";

import {
  finalizeCreateProject,
  loadCreateAssets,
  markCreateFailed,
} from "~/server/create/create-pipeline";
import {
  createMediaProgressGate,
  runCreateJobs,
  settleMediaJobs,
  withJobIO,
} from "~/server/create/jobs/create-job";
import { measureJob } from "~/server/create/jobs/measure";
import { whisperXJob } from "~/server/create/jobs/whisperx";
import { publishCreateProgress } from "~/server/create/publish-progress";
import { FalMeasureError } from "~/server/media/measure-audio";

import type { CreateProgressEvent } from "~/domain/create-progress";
import type { CreateAssetRef } from "~/server/create/create-pipeline";
import type { CreateJobIO } from "~/server/create/jobs/create-job";
import type { MeasureHandle } from "~/server/create/jobs/measure";
import type { WhisperXHandle } from "~/server/create/jobs/whisperx";

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

  try {
    const assets = await loadAssetsStep(projectId);
    const cancel = { cancelled: false };
    const gate = createMediaProgressGate({
      publish: (event) => emitProgressStep(projectId, event),
      cancel,
    });
    await settleMediaJobs(
      runCreateJobs({
        job: withJobIO(whisperXJob, whisperXSteps),
        assets,
        maxPolls: WHISPERX_MAX_POLLS,
        sleep: () => sleep(WHISPERX_POLL_SLEEP),
        onProgress: gate.onTranscribe,
        cancel,
      }),
      runCreateJobs({
        job: withJobIO(measureJob, measureSteps),
        assets,
        maxPolls: FAL_MAX_POLLS,
        sleep: () => sleep(FAL_POLL_SLEEP),
        onProgress: gate.onMeasure,
        cancel,
      }),
    );
    await finalizeStep(projectId);
  } catch (error) {
    const message =
      error instanceof FatalError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Create workflow failed";
    await markFailedStep(projectId, message);
    if (error instanceof FatalError) throw error;
    throw new FatalError(message);
  }
}

const whisperXSteps: CreateJobIO<WhisperXHandle> = {
  start: startWhisperXStep,
  poll: pollWhisperXBatchStep,
  finish: finishWhisperXStep,
  fail: failWhisperXStep,
};

const measureSteps: CreateJobIO<MeasureHandle> = {
  start: startMeasureStep,
  poll: pollMeasureBatchStep,
  finish: finishMeasureStep,
};

async function emitProgressStep(
  projectId: string,
  event: CreateProgressEvent,
): Promise<void> {
  "use step";
  await publishCreateProgress(projectId, event);
}

async function loadAssetsStep(projectId: string): Promise<CreateAssetRef[]> {
  "use step";
  return loadCreateAssets(projectId);
}

async function startWhisperXStep(asset: CreateAssetRef) {
  "use step";
  return whisperXJob.start(asset);
}

async function pollWhisperXBatchStep(
  jobs: Array<{ index: number; handle: WhisperXHandle }>,
) {
  "use step";
  return whisperXJob.poll(jobs);
}

async function finishWhisperXStep(
  asset: CreateAssetRef,
  handle: WhisperXHandle,
) {
  "use step";
  await whisperXJob.finish(asset, handle);
}

async function failWhisperXStep(asset: CreateAssetRef, reason: string) {
  "use step";
  await whisperXJob.fail(asset, reason);
}

async function startMeasureStep(asset: CreateAssetRef) {
  "use step";
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
  try {
    return await measureJob.poll(jobs);
  } catch (error) {
    rethrowFatalFal(error);
  }
}

async function finishMeasureStep(asset: CreateAssetRef, handle: MeasureHandle) {
  "use step";
  try {
    await measureJob.finish(asset, handle);
  } catch (error) {
    rethrowFatalFal(error);
  }
}

async function finalizeStep(projectId: string): Promise<void> {
  "use step";
  await finalizeCreateProject(projectId);
}

async function markFailedStep(
  projectId: string,
  reason: string,
): Promise<void> {
  "use step";
  await markCreateFailed(projectId, reason);
}

function rethrowFatalFal(error: unknown): never {
  if (error instanceof FalMeasureError && error.fatal) {
    throw new FatalError(error.message);
  }
  throw error;
}
