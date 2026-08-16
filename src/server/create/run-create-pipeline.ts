import {
  finalizeCreateProject,
  loadCreateAssets,
  markAssetTranscriptFailed,
  markCreateFailed,
  measureCreateAssets,
  saveAssetTranscript,
  startAssetWhisperX,
} from "~/server/create/create-pipeline";
import {
  transcribeStageEvent,
  whisperJobProgress,
} from "~/server/create/progress-estimate";
import { publishCreateProgress } from "~/server/create/publish-progress";
import { getWhisperXPrediction } from "~/server/transcribe/whisperx";

const IN_PROCESS_POLL_MS = 5_000;
const IN_PROCESS_MAX_POLLS = 360; // ~30 min

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
  const projectAssets = await loadCreateAssets(projectId);
  const assetProgress = projectAssets.map(() => 0);
  await publishCreateProgress(projectId, transcribeStageEvent(assetProgress));

  for (let i = 0; i < projectAssets.length; i++) {
    const asset = projectAssets[i]!;
    const started = await startAssetWhisperX(asset);
    if (started.alreadyReady) {
      assetProgress[i] = 1;
      await publishCreateProgress(
        projectId,
        transcribeStageEvent(assetProgress),
      );
      continue;
    }

    const startedAtMs = Date.now();
    let succeeded = false;
    for (let p = 0; p < IN_PROCESS_MAX_POLLS; p++) {
      const poll = await getWhisperXPrediction(started.predictionId);
      assetProgress[i] = whisperJobProgress(
        poll.status,
        startedAtMs,
        Date.now(),
      );
      await publishCreateProgress(
        projectId,
        transcribeStageEvent(assetProgress),
      );
      if (poll.status === "succeeded") {
        await saveAssetTranscript(asset, started.predictionId);
        assetProgress[i] = 1;
        await publishCreateProgress(
          projectId,
          transcribeStageEvent(assetProgress),
        );
        succeeded = true;
        break;
      }
      if (
        poll.status === "failed" ||
        poll.status === "canceled" ||
        poll.status === "aborted"
      ) {
        const message = poll.error ?? `WhisperX ${poll.status}`;
        await markAssetTranscriptFailed(asset.id, message);
        throw new Error(
          `WhisperX failed for ${asset.originalFilename ?? asset.id}: ${message}`,
        );
      }
      await new Promise((r) => setTimeout(r, IN_PROCESS_POLL_MS));
    }

    if (!succeeded) {
      const message = "WhisperX timed out";
      await markAssetTranscriptFailed(asset.id, message);
      throw new Error(
        `WhisperX timed out for ${asset.originalFilename ?? asset.id}`,
      );
    }
  }

  await measureCreateAssets(projectId);
  await finalizeCreateProject(projectId);
}
