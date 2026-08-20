import {
  finalizeCreateProject,
  loadCreateAssets,
  markCreateFailed,
} from "~/server/workflow/create/pipeline";
import {
  createMediaProgressGate,
  settleMediaJobs,
} from "~/server/workflow/create/media-progress";
import { measureJob } from "~/server/workflow/create/jobs/measure";
import { whisperXJob } from "~/server/workflow/create/jobs/whisperx";
import { publishCreateProgress } from "~/server/workflow/create/publish";
import { runJobs } from "~/server/workflow/job";
import { inProcessSleep } from "~/server/workflow/kickoff";

/** ~30 min wall time for the whole transcribe stage. */
const IN_PROCESS_TRANSCRIBE_MAX_POLLS = 360;
/** ~10 min wall time for the whole measure stage. */
const IN_PROCESS_MEASURE_MAX_POLLS = 120;

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
    runJobs({
      job: whisperXJob,
      items: assets,
      maxPolls: IN_PROCESS_TRANSCRIBE_MAX_POLLS,
      sleep: inProcessSleep,
      onProgress: gate.onTranscribe,
      cancel,
    }),
    runJobs({
      job: measureJob,
      items: assets,
      maxPolls: IN_PROCESS_MEASURE_MAX_POLLS,
      sleep: inProcessSleep,
      onProgress: gate.onMeasure,
      cancel,
    }),
  );
  await finalizeCreateProject(projectId);
}
