import {
  markAssetTranscriptFailed,
  saveAssetTranscript,
  startAssetWhisperX,
} from "~/server/create/create-pipeline";
import { whisperJobProgress } from "~/server/create/progress-estimate";
import { getWhisperXPrediction } from "~/server/transcribe/whisperx";

import type {
  CreateAssetRef,
  CreateJob,
  JobPollResult,
  WhisperXHandle,
} from "~/server/create/jobs/create-job";

export type { WhisperXHandle };

export class WhisperXJob implements CreateJob<WhisperXHandle> {
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
        const progress = whisperJobProgress(
          poll.status,
          handle.startedAtMs,
          nowMs,
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
