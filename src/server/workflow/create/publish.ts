import { eq } from "drizzle-orm";

import { isCreateProgressEvent } from "~/domain/project/create-progress";
import { makeProgressBus } from "~/server/workflow/progress-bus";
import { publishProgress } from "~/server/workflow/publish";
import { db } from "~/server/db";
import { projects } from "~/server/db/schema";

import type { CreateProgressEvent } from "~/domain/project/create-progress";

export const createProgressBus = makeProgressBus<CreateProgressEvent>();

export async function publishCreateProgress(
  projectId: string,
  event: CreateProgressEvent,
): Promise<void> {
  await publishProgress({
    id: projectId,
    event,
    bus: createProgressBus,
    persist: async (id, next) => {
      await db
        .update(projects)
        .set({
          createProgress: next,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id));
    },
  });
}

export function parseCreateProgress(
  value: unknown,
): CreateProgressEvent | null {
  return isCreateProgressEvent(value) ? value : null;
}
