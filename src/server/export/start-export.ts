import { and, eq } from "drizzle-orm";

import { db } from "~/server/db";
import { projects } from "~/server/db/schema";
import { buildExportProps } from "~/server/export/build-export-props";
import { startLambdaRender } from "~/server/export/lambda";

export async function startProjectExport(options: {
  projectId: string;
  userId: string;
}): Promise<{ renderId: string }> {
  const [project] = await db
    .select({
      id: projects.id,
      status: projects.status,
    })
    .from(projects)
    .where(
      and(
        eq(projects.id, options.projectId),
        eq(projects.userId, options.userId),
      ),
    )
    .limit(1);

  if (!project) {
    throw new Error("Project not found");
  }
  if (project.status === "exporting") {
    throw new Error("Export already in progress");
  }
  if (project.status !== "ready") {
    throw new Error(`Cannot export while status is ${project.status}`);
  }

  const props = await buildExportProps(options.projectId);
  if (props.sections.length === 0 || props.durationInFrames < 1) {
    throw new Error("Nothing to export — add A-roll keeps first");
  }

  // Claim exporting before kicking Lambda so a second click cannot race.
  const claimed = await db
    .update(projects)
    .set({
      status: "exporting",
      failureReason: null,
      exportRenderId: null,
      exportBucketName: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(projects.id, options.projectId), eq(projects.status, "ready")),
    )
    .returning({ id: projects.id });

  if (claimed.length === 0) {
    throw new Error("Export already in progress");
  }

  try {
    const { renderId, bucketName } = await startLambdaRender({
      projectId: options.projectId,
      props,
    });

    await db
      .update(projects)
      .set({
        exportRenderId: renderId,
        exportBucketName: bucketName,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, options.projectId));

    return { renderId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(projects)
      .set({
        status: "ready",
        failureReason: message,
        exportRenderId: null,
        exportBucketName: null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, options.projectId));
    throw err;
  }
}
