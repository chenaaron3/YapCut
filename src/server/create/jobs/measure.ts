import { falJobProgress } from "~/server/create/progress-estimate";
import {
  finishMeasureAssetJobs,
  pollMeasureAssetJobs,
  startMeasureAssetJobs,
} from "~/server/media/measure-asset";

import type {
  CreateAssetRef,
  CreateJob,
  JobPollResult,
  MeasureHandle,
} from "~/server/create/jobs/create-job";

export type { MeasureHandle };

export class MeasureJob implements CreateJob<MeasureHandle> {
  readonly name = "fal measure";

  async start(asset: CreateAssetRef): Promise<MeasureHandle | null> {
    const jobSet = await startMeasureAssetJobs(asset);
    return { jobSet, startedAtMs: Date.now() };
  }

  async poll(
    jobs: Array<{ index: number; handle: MeasureHandle }>,
  ): Promise<JobPollResult[]> {
    const nowMs = Date.now();
    return Promise.all(
      jobs.map(async ({ index, handle }) => {
        const poll = await pollMeasureAssetJobs(handle.jobSet);
        const progress =
          (falJobProgress(poll.loudnorm, handle.startedAtMs, nowMs) +
            falJobProgress(poll.waveform, handle.startedAtMs, nowMs)) /
          2;
        return {
          index,
          progress,
          status: poll.done ? ("done" as const) : ("pending" as const),
        };
      }),
    );
  }

  async finish(_asset: CreateAssetRef, handle: MeasureHandle): Promise<void> {
    await finishMeasureAssetJobs(handle.jobSet);
  }
}

export const measureJob = new MeasureJob();
