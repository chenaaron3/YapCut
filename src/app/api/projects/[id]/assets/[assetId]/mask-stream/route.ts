import { and, eq } from "drizzle-orm";

import { parseMaskProgress } from "~/domain/asset/mask-progress";
import { auth } from "~/server/auth";
import { maskProgressBus } from "~/server/workflow/mask/publish";
import {
  workflowProgressResponse,
  workflowStreamStartIndex,
} from "~/server/workflow/stream";
import { db } from "~/server/db";
import { assets, masks, projects } from "~/server/db/schema";
import { canAccessProject } from "~/server/project/access";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; assetId: string }> },
) {
  const session = await auth();
  const { id, assetId } = await context.params;
  const [project] = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project || !canAccessProject(project, session)) {
    return new Response("Not found", { status: 404 });
  }

  const [mask] = await db
    .select({
      runId: masks.runId,
      progress: masks.progress,
    })
    .from(masks)
    .innerJoin(assets, eq(assets.id, masks.assetId))
    .where(and(eq(masks.assetId, assetId), eq(assets.projectId, id)))
    .limit(1);

  if (!mask) {
    return new Response("Not found", { status: 404 });
  }

  return workflowProgressResponse({
    id: assetId,
    runId: mask.runId,
    startIndex: workflowStreamStartIndex(request),
    snapshot: parseMaskProgress(mask.progress),
    bus: maskProgressBus,
  });
}
