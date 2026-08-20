import { eq } from "drizzle-orm";

import { maskProgressEvent } from "~/domain/asset/mask-progress";
import { makeProgressBus } from "~/server/workflow/progress-bus";
import { publishProgress } from "~/server/workflow/publish";
import { db } from "~/server/db";
import { masks } from "~/server/db/schema";

import type { MaskProgressEvent } from "~/domain/asset/mask-progress";

export const maskProgressBus = makeProgressBus<MaskProgressEvent>();

export async function publishMaskProgress(
  assetId: string,
  event: MaskProgressEvent,
): Promise<void> {
  await publishProgress({
    id: assetId,
    event,
    bus: maskProgressBus,
    persist: async (id, next) => {
      await db
        .update(masks)
        .set({
          progress: next,
          updatedAt: new Date(),
        })
        .where(eq(masks.assetId, id));
    },
  });
}

/** Poll estimates only — persist/fail own the terminal `ready` / `failed` events. */
export async function publishMaskJobProgress(
  assetId: string,
  progress: number,
): Promise<void> {
  if (progress >= 1) return;
  await publishMaskProgress(assetId, maskProgressEvent("running", progress));
}
