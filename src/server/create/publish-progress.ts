import { eq } from "drizzle-orm";

import { isCreateProgressEvent } from "~/domain/project/create-progress";
import { fanoutCreateProgress } from "~/server/create/progress-bus";
import { db } from "~/server/db";
import { projects } from "~/server/db/schema";

import type { CreateProgressEvent } from "~/domain/project/create-progress";

const OUTSIDE_WORKFLOW =
  "`getWritable()` can only be called inside a workflow or step function";

async function writeWorkflowStream(event: CreateProgressEvent): Promise<void> {
  try {
    const { getWritable } = await import("workflow");
    const writable = getWritable<string>();
    const writer = writable.getWriter();
    try {
      await writer.write(`${JSON.stringify(event)}\n`);
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

export async function publishCreateProgress(
  projectId: string,
  event: CreateProgressEvent,
): Promise<void> {
  await db
    .update(projects)
    .set({
      createProgress: event,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));
  fanoutCreateProgress(projectId, event);
  await writeWorkflowStream(event);
}

export function parseCreateProgress(
  value: unknown,
): CreateProgressEvent | null {
  return isCreateProgressEvent(value) ? value : null;
}
