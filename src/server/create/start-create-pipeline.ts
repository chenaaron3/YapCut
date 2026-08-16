import { eq } from "drizzle-orm";

import { env } from "~/env";
import { runCreatePipeline } from "~/server/create/run-create-pipeline";
import { db } from "~/server/db";
import { projects } from "~/server/db/schema";

/**
 * Kick off create processing without blocking the tRPC response.
 *
 * - Default / development: fire-and-forget in-process (`runCreatePipeline`)
 * - `USE_VERCEL_WORKFLOW=true`: start durable Workflow SDK run
 */
export async function startCreatePipeline(projectId: string): Promise<void> {
  if (env.USE_VERCEL_WORKFLOW) {
    try {
      const { start } = await import("workflow/api");
      const { createProjectWorkflow } =
        await import("~/workflows/create-project");
      const run = await start(createProjectWorkflow, [projectId]);
      await db
        .update(projects)
        .set({ workflowRunId: run.runId, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
      console.log(
        `[create] started Vercel Workflow for ${projectId} run=${run.runId}`,
      );
      return;
    } catch (error) {
      console.warn(
        "[create] Vercel Workflow start failed; falling back in-process:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Dev / fallback: do not await — return to client while pipeline runs.
  void runCreatePipeline(projectId).catch((error: unknown) => {
    console.error(
      `[create] in-process pipeline crashed for ${projectId}:`,
      error,
    );
  });
  console.log(`[create] started in-process pipeline for ${projectId}`);
}
