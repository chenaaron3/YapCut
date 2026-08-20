import { env } from "~/env";

/** In-process poll gap (matches fal / Workflow sleep of 5s). */
const IN_PROCESS_POLL_MS = 5_000;

export function inProcessSleep(): Promise<void> {
  return new Promise((r) => setTimeout(r, IN_PROCESS_POLL_MS));
}

/**
 * Start a pipeline without blocking the tRPC response.
 *
 * `USE_VERCEL_WORKFLOW=true`: durable Workflow SDK run + persist run id.
 * Otherwise (and on start failure): fire-and-forget in-process.
 */
export async function kickoffWorkflow(input: {
  name: string;
  id: string;
  startDurable: () => Promise<string>;
  persistRunId: (runId: string) => Promise<void>;
  runInProcess: () => Promise<void>;
}): Promise<void> {
  if (env.USE_VERCEL_WORKFLOW) {
    try {
      const runId = await input.startDurable();
      await input.persistRunId(runId);
      console.log(
        `[${input.name}] started Vercel Workflow for ${input.id} run=${runId}`,
      );
      return;
    } catch (error) {
      console.warn(
        `[${input.name}] Vercel Workflow start failed; falling back in-process:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  void input.runInProcess().catch((error: unknown) => {
    console.error(
      `[${input.name}] in-process pipeline crashed for ${input.id}:`,
      error,
    );
  });
  console.log(`[${input.name}] started in-process pipeline for ${input.id}`);
}
