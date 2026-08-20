/**
 * Vercel Workflow for A-roll Separate background / B-roll Remove background.
 * Started when `USE_VERCEL_WORKFLOW=true` (see `startMaskPipeline`).
 *
 * Same Job runner as create (enqueue fal, sleep/poll, persist).
 *
 * @see https://workflow-sdk.dev/docs/getting-started/next
 */
import { sleep } from "workflow";

import { rethrowAsFatal, rethrowFatalFal } from "~/server/workflow/fatal";
import { runJobs } from "~/server/workflow/job";

import type {
  MaskAssetRef,
  MaskJobHandle,
} from "~/server/workflow/mask/io";
import type { Job } from "~/server/workflow/job";

/** Suspend between fal BiRefNet polls. */
const FAL_POLL_SLEEP = "5s";
/** ~15 minutes of wall time. */
const FAL_MAX_POLLS = 180;

export async function maskWorkflow(
  projectId: string,
  assetId: string,
) {
  "use workflow";

  const maskWorkflowJob: Job<MaskJobHandle, MaskAssetRef> = {
    name: "mask",
    start: (asset) => startMaskStep(asset),
    poll: (jobs) => pollMaskBatchStep(jobs),
    finish: (asset, handle) => finishMaskStep(asset, handle),
    fail: (asset, reason) => failMaskStep(asset, reason),
  };

  try {
    const asset = await loadAssetStep(projectId, assetId);
    if (!asset) return;
    await runJobs({
      job: maskWorkflowJob,
      items: [asset],
      maxPolls: FAL_MAX_POLLS,
      sleep: () => sleep(FAL_POLL_SLEEP),
      onProgress: (progress) => emitProgressStep(asset.id, progress),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mask workflow failed";
    const asset = await loadAssetStep(projectId, assetId);
    if (asset) await failMaskStep(asset, message);
    rethrowAsFatal(error, "Mask workflow failed");
  }
}

async function emitProgressStep(
  assetId: string,
  progress: number,
): Promise<void> {
  "use step";
  const { publishMaskJobProgress } = await import(
    "~/server/workflow/mask/publish"
  );
  await publishMaskJobProgress(assetId, progress);
}

async function loadAssetStep(
  projectId: string,
  assetId: string,
): Promise<MaskAssetRef | null> {
  "use step";
  const { db } = await import("~/server/db");
  const { loadMaskAssetRef } = await import("~/server/workflow/mask/io");
  return loadMaskAssetRef(db, projectId, assetId);
}

async function startMaskStep(asset: MaskAssetRef) {
  "use step";
  const { maskJob } = await import("~/server/workflow/mask/jobs/mask");
  try {
    return await maskJob.start(asset);
  } catch (error) {
    rethrowFatalFal(error);
  }
}

async function pollMaskBatchStep(
  jobs: Array<{ index: number; handle: MaskJobHandle }>,
) {
  "use step";
  const { maskJob } = await import("~/server/workflow/mask/jobs/mask");
  try {
    return await maskJob.poll(jobs);
  } catch (error) {
    rethrowFatalFal(error);
  }
}

async function finishMaskStep(asset: MaskAssetRef, handle: MaskJobHandle) {
  "use step";
  const { maskJob } = await import("~/server/workflow/mask/jobs/mask");
  try {
    await maskJob.finish(asset, handle);
  } catch (error) {
    rethrowFatalFal(error);
  }
}

async function failMaskStep(asset: MaskAssetRef, reason: string) {
  "use step";
  const { maskJob } = await import("~/server/workflow/mask/jobs/mask");
  await maskJob.fail(asset, reason);
}
