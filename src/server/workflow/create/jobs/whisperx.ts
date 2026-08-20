import { TRANSCRIBE_PROGRESS_TAU_SEC } from "~/domain/project/create-progress";
import { replicateJobProgress } from "~/server/workflow/estimate";
import {
  markAssetTranscriptFailed,
  saveAssetTranscript,
  startAssetWhisperX,
} from "~/server/workflow/create/pipeline";
import { getWhisperXPrediction } from "~/server/transcribe/whisperx";

import type { CreateAssetRef } from "~/server/workflow/create/pipeline";
import type { Job, JobPollResult } from "~/server/workflow/job";

export type WhisperXHandle = {
  predictionId: string;
  startedAtMs: number;
};

export class WhisperXJob implements Job<WhisperXHandle, CreateAssetRef> {
  readonly name = "WhisperX";

  async start(asset: CreateAssetRef): Promise<WhisperXHandle | null> {
    const started = await startAssetWhisperX(asset);
    if (started.alreadyReady) return null;
    return {
      predictionId: started.predictionId,
      startedAtMs: Date.now(),
    };
  }

  async poll(
    jobs: Array<{ index: number; handle: WhisperXHandle }>,
  ): Promise<JobPollResult[]> {
    const nowMs = Date.now();
    return Promise.all(
      jobs.map(async ({ index, handle }) => {
        const poll = await getWhisperXPrediction(handle.predictionId);
        console.log(
          `[create] whisperx poll prediction=${handle.predictionId} status=${poll.status}`,
        );
        const progress = replicateJobProgress(
          poll.status,
          handle.startedAtMs,
          nowMs,
          TRANSCRIBE_PROGRESS_TAU_SEC,
        );
        if (poll.status === "succeeded") {
          return { index, progress, status: "done" as const };
        }
        if (
          poll.status === "failed" ||
          poll.status === "canceled" ||
          poll.status === "aborted"
        ) {
          return {
            index,
            progress,
            status: "failed" as const,
            error: poll.error ?? `WhisperX ${poll.status}`,
          };
        }
        return { index, progress, status: "pending" as const };
      }),
    );
  }

  async finish(asset: CreateAssetRef, handle: WhisperXHandle): Promise<void> {
    await saveAssetTranscript(asset, handle.predictionId);
  }

  async fail(asset: CreateAssetRef, reason: string): Promise<void> {
    await markAssetTranscriptFailed(asset.id, reason);
  }
}

export const whisperXJob = new WhisperXJob();
