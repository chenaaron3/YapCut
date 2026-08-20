import { eq } from "drizzle-orm";

import { runCreatePipeline } from "~/server/workflow/create/run";
import { kickoffWorkflow } from "~/server/workflow/kickoff";
import { db } from "~/server/db";
import { projects } from "~/server/db/schema";

/**
 * Kick off create processing without blocking the tRPC response.
 */
export async function startCreatePipeline(projectId: string): Promise<void> {
  await kickoffWorkflow({
    name: "create",
    id: projectId,
    startDurable: async () => {
      const { start } = await import("workflow/api");
      const { createProjectWorkflow } =
        await import("~/workflows/create-project");
      const run = await start(createProjectWorkflow, [projectId]);
      return run.runId;
    },
    persistRunId: async (runId) => {
      await db
        .update(projects)
        .set({ workflowRunId: runId, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
    },
    runInProcess: () => runCreatePipeline(projectId),
  });
}
