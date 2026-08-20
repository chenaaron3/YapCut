import { MEASURE_PROGRESS_TAU_SEC } from "~/domain/project/create-progress";
import { falJobProgress } from "~/server/workflow/estimate";
import {
  finishMeasureAssetJobs,
  pollMeasureAssetJobs,
  startMeasureAssetJobs,
} from "~/server/media/measure-asset";

import type { CreateAssetRef } from "~/server/workflow/create/pipeline";
import type { MeasureJobSet } from "~/server/media/measure-asset";
import type { Job, JobPollResult } from "~/server/workflow/job";

export type MeasureHandle = {
  jobSet: MeasureJobSet;
  startedAtMs: number;
};

export class MeasureJob implements Job<MeasureHandle, CreateAssetRef> {
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
          (falJobProgress(
            poll.loudnorm,
            handle.startedAtMs,
            nowMs,
            MEASURE_PROGRESS_TAU_SEC,
          ) +
            falJobProgress(
              poll.waveform,
              handle.startedAtMs,
              nowMs,
              MEASURE_PROGRESS_TAU_SEC,
            )) /
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
