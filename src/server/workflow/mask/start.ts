import { eq } from "drizzle-orm";

import { runMaskPipeline } from "~/server/workflow/mask/run";
import { kickoffWorkflow } from "~/server/workflow/kickoff";
import { db } from "~/server/db";
import { masks } from "~/server/db/schema";

/**
 * Kick off BiRefNet masking without blocking the tRPC response.
 */
export async function startMaskPipeline(
  projectId: string,
  assetId: string,
): Promise<void> {
  await kickoffWorkflow({
    name: "mask",
    id: assetId,
    startDurable: async () => {
      const { start } = await import("workflow/api");
      const { maskWorkflow } = await import("~/workflows/mask");
      const run = await start(maskWorkflow, [projectId, assetId]);
      return run.runId;
    },
    persistRunId: async (runId) => {
      await db
        .update(masks)
        .set({ runId, updatedAt: new Date() })
        .where(eq(masks.assetId, assetId));
    },
    runInProcess: () => runMaskPipeline(projectId, assetId),
  });
}
