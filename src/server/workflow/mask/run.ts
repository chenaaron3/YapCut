import { maskJob } from "~/server/workflow/mask/jobs/mask";
import { publishMaskJobProgress } from "~/server/workflow/mask/publish";
import { runJobs } from "~/server/workflow/job";
import { inProcessSleep } from "~/server/workflow/kickoff";
import { db } from "~/server/db";
import {
  failMaskJob,
  loadMaskAssetRef,
} from "~/server/workflow/mask/io";

/** ~15 min wall time (video BiRefNet can be slow). */
const IN_PROCESS_MAX_POLLS = 180;

/**
 * Mask pipeline for local / in-process fallback.
 * Blocks inside this process (ok for `next dev`; unreliable on serverless).
 */
export async function runMaskPipeline(
  projectId: string,
  assetId: string,
): Promise<void> {
  const asset = await loadMaskAssetRef(db, projectId, assetId);
  if (!asset) return;
  try {
    await runJobs({
      job: maskJob,
      items: [asset],
      maxPolls: IN_PROCESS_MAX_POLLS,
      sleep: inProcessSleep,
      onProgress: (progress) => publishMaskJobProgress(assetId, progress),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mask pipeline failed";
    await failMaskJob(db, asset, message);
  }
}
