import { eq } from "drizzle-orm";
import { getRun } from "workflow/api";

import { auth } from "~/server/auth";
import {
  lastCreateProgress,
  subscribeCreateProgress,
} from "~/server/create/progress-bus";
import { parseCreateProgress } from "~/server/create/publish-progress";
import { db } from "~/server/db";
import { projects } from "~/server/db/schema";
import { canAccessProject } from "~/server/project-access";

import type { CreateProgressEvent } from "~/domain/project/create-progress";

export const maxDuration = 300;
export const runtime = "nodejs";

function encodeEvent(event: CreateProgressEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

function localProgressStream(
  projectId: string,
  snapshot: CreateProgressEvent | null,
): ReadableStream<Uint8Array> {
  let unsubscribe: (() => void) | undefined;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const initial = lastCreateProgress(projectId) ?? snapshot;
      if (initial) controller.enqueue(encodeEvent(initial));
      if (initial?.stage === "ready" || initial?.stage === "failed") {
        controller.close();
        return;
      }
      unsubscribe = subscribeCreateProgress(projectId, (event) => {
        try {
          controller.enqueue(encodeEvent(event));
          if (event.stage === "ready" || event.stage === "failed") {
            unsubscribe?.();
            controller.close();
          }
        } catch {
          unsubscribe?.();
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });
}

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

  const snapshot = parseCreateProgress(project.createProgress);
  const startIndexParam = new URL(request.url).searchParams.get("startIndex");
  const startIndex = startIndexParam
    ? Number.parseInt(startIndexParam, 10)
    : undefined;

  const stream =
    project.workflowRunId != null && project.workflowRunId.length > 0
      ? getRun(project.workflowRunId).getReadable<string>({
          startIndex:
            startIndex !== undefined && Number.isFinite(startIndex)
              ? startIndex
              : undefined,
        })
      : localProgressStream(id, snapshot);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...(project.workflowRunId
        ? { "x-workflow-run-id": project.workflowRunId }
        : {}),
    },
  });
}
