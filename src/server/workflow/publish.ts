import { writeWorkflowNdjson } from "~/server/workflow/workflow-stream";

import type { ProgressBus } from "~/server/workflow/progress-bus";

/** Persist + in-process fanout + Workflow NDJSON. */
export async function publishProgress<Event>(input: {
  id: string;
  event: Event;
  bus: ProgressBus<Event>;
  persist: (id: string, event: Event) => Promise<void>;
}): Promise<void> {
  await input.persist(input.id, input.event);
  input.bus.fanout(input.id, input.event);
  await writeWorkflowNdjson(`${JSON.stringify(input.event)}\n`);
}
