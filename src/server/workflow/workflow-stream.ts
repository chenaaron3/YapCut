/** Durable NDJSON line for Vercel Workflow `getWritable()` / `getReadable()`. */
const OUTSIDE_WORKFLOW =
  "`getWritable()` can only be called inside a workflow or step function";

export async function writeWorkflowNdjson(line: string): Promise<void> {
  try {
    const { getWritable } = await import("workflow");
    const writable = getWritable<string>();
    const writer = writable.getWriter();
    try {
      await writer.write(line.endsWith("\n") ? line : `${line}\n`);
    } finally {
      writer.releaseLock();
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes(OUTSIDE_WORKFLOW)) {
      return;
    }
    throw error;
  }
}
