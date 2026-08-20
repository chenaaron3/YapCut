import { eq } from "drizzle-orm";

import { auth } from "~/server/auth";
import {
  createProgressBus,
  parseCreateProgress,
} from "~/server/workflow/create/publish";
import {
  workflowProgressResponse,
  workflowStreamStartIndex,
} from "~/server/workflow/stream";
import { db } from "~/server/db";
import { projects } from "~/server/db/schema";
import { canAccessProject } from "~/server/project/access";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await context.params;
  const [project] = await db
    .select({
      userId: projects.userId,
      workflowRunId: projects.workflowRunId,
      createProgress: projects.createProgress,
    })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project || !canAccessProject(project, session)) {
    return new Response("Not found", { status: 404 });
  }

  return workflowProgressResponse({
    id,
    runId: project.workflowRunId,
    startIndex: workflowStreamStartIndex(request),
    snapshot: parseCreateProgress(project.createProgress),
    bus: createProgressBus,
  });
}
