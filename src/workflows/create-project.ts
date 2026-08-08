/**
 * Vercel Workflow definition for project create.
 * Started when `USE_VERCEL_WORKFLOW=true` (see `startCreatePipeline`).
 *
 * @see https://workflow-sdk.dev/docs/getting-started/next
 */
import { runCreatePipeline } from "~/server/create/run-create-pipeline";

export async function createProjectWorkflow(projectId: string) {
  "use workflow";

  await transcribeAndSeedStep(projectId);
}

async function transcribeAndSeedStep(projectId: string) {
  "use step";

  await runCreatePipeline(projectId);
}
