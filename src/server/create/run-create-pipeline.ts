import {
  finalizeCreateProject,
  loadCreateAssets,
  markCreateFailed,
} from "~/server/create/create-pipeline";
import {
  createMediaProgressGate,
  runCreateJobs,
  settleMediaJobs,
} from "~/server/create/jobs/create-job";
import { measureJob } from "~/server/create/jobs/measure";
import { whisperXJob } from "~/server/create/jobs/whisperx";
import { publishCreateProgress } from "~/server/create/publish-progress";

const IN_PROCESS_POLL_MS = 5_000;
/** ~30 min wall time for the whole transcribe stage. */
const IN_PROCESS_TRANSCRIBE_MAX_POLLS = 360;
/** ~10 min wall time for the whole measure stage. */
const IN_PROCESS_MEASURE_MAX_POLLS = 120;

function inProcessSleep(): Promise<void> {
  return new Promise((r) => setTimeout(r, IN_PROCESS_POLL_MS));
}

/**
 * End-to-end create pipeline for local / in-process fallback.
 * Blocks inside this process (ok for `next dev`; unreliable on serverless).
 */
export async function runCreatePipeline(projectId: string): Promise<void> {
  try {
    await runCreatePipelineInner(projectId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Create pipeline failed";
    await markCreateFailed(projectId, message);
  }
}

async function runCreatePipelineInner(projectId: string): Promise<void> {
  const assets = await loadCreateAssets(projectId);
  const cancel = { cancelled: false };
  const gate = createMediaProgressGate({
    publish: (event) => publishCreateProgress(projectId, event),
    cancel,
  });

  await settleMediaJobs(
    runCreateJobs({
      job: whisperXJob,
      assets,
      maxPolls: IN_PROCESS_TRANSCRIBE_MAX_POLLS,
      sleep: inProcessSleep,
      onProgress: gate.onTranscribe,
      cancel,
    }),
    runCreateJobs({
      job: measureJob,
      assets,
      maxPolls: IN_PROCESS_MEASURE_MAX_POLLS,
      sleep: inProcessSleep,
      onProgress: gate.onMeasure,
      cancel,
    }),
  );
  await finalizeCreateProject(projectId);
}
