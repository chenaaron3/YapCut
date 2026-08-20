import {
  MASK_IMAGE_TAU_SEC,
  MASK_VIDEO_TAU_SEC,
} from "~/domain/asset/mask-progress";
import { falJobProgress } from "~/server/workflow/estimate";
import { db } from "~/server/db";
import {
  failMaskJob,
  persistMaskJob,
  pollMaskJob,
  startMaskJob,
} from "~/server/workflow/mask/io";

import type { Job, JobPollResult } from "~/server/workflow/job";
import type {
  MaskAssetRef,
  MaskJobHandle,
} from "~/server/workflow/mask/io";

export class MaskJob implements Job<MaskJobHandle, MaskAssetRef> {
  readonly name = "mask";

  async start(asset: MaskAssetRef): Promise<MaskJobHandle | null> {
    return startMaskJob(db, asset);
  }

  async poll(
    jobs: Array<{ index: number; handle: MaskJobHandle }>,
  ): Promise<JobPollResult[]> {
    const nowMs = Date.now();
    return Promise.all(
      jobs.map(async ({ index, handle }) => {
        const poll = await pollMaskJob(handle);
        const tauSec =
          handle.kind === "video" ? MASK_VIDEO_TAU_SEC : MASK_IMAGE_TAU_SEC;
        return {
          index,
          progress: falJobProgress(
            poll.status,
            handle.startedAtMs,
            nowMs,
            tauSec,
          ),
          status: poll.done ? ("done" as const) : ("pending" as const),
        };
      }),
    );
  }

  async finish(asset: MaskAssetRef, handle: MaskJobHandle): Promise<void> {
    await persistMaskJob(db, asset, handle);
  }

  async fail(asset: MaskAssetRef, reason: string): Promise<void> {
    await failMaskJob(db, asset, reason);
  }
}

export const maskJob = new MaskJob();
