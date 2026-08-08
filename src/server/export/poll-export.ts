import { and, eq } from "drizzle-orm";

import { db } from "~/server/db";
import { projects } from "~/server/db/schema";
import { exportDownloadUrl } from "~/server/export/download-url";
import { fetchLambdaProgress } from "~/server/export/lambda";

export type ExportProgressResult = {
  status: string;
  progress: number;
  exportS3Key: string | null;
  downloadUrl: string | null;
  failureReason: string | null;
};

async function downloadFor(
  bucketName: string | null,
  key: string | null,
): Promise<string | null> {
  if (!bucketName || !key) return null;
  return exportDownloadUrl({ bucketName, objectKey: key });
}

export async function pollProjectExport(options: {
  projectId: string;
  userId: string;
}): Promise<ExportProgressResult> {
  const [project] = await db
    .select({
      id: projects.id,
      status: projects.status,
      exportS3Key: projects.exportS3Key,
      exportRenderId: projects.exportRenderId,
      exportBucketName: projects.exportBucketName,
      failureReason: projects.failureReason,
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

  if (project.status !== "exporting") {
    return {
      status: project.status,
      progress: project.exportS3Key ? 1 : 0,
      exportS3Key: project.exportS3Key,
      downloadUrl: await downloadFor(
        project.exportBucketName,
        project.exportS3Key,
      ),
      failureReason: project.failureReason,
    };
  }

  if (!project.exportRenderId || !project.exportBucketName) {
    return {
      status: "exporting",
      progress: 0,
      exportS3Key: project.exportS3Key,
      downloadUrl: null,
      failureReason: null,
    };
  }

  const progress = await fetchLambdaProgress({
    renderId: project.exportRenderId,
    bucketName: project.exportBucketName,
  });

  if (progress.fatalErrorEncountered) {
    const reason =
      progress.errors[0]?.message ?? "Remotion Lambda render failed";
    await db
      .update(projects)
      .set({
        status: "ready",
        failureReason: reason,
        exportRenderId: null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, options.projectId));

    return {
      status: "ready",
      progress: progress.overallProgress,
      exportS3Key: project.exportS3Key,
      downloadUrl: await downloadFor(
        project.exportBucketName,
        project.exportS3Key,
      ),
      failureReason: reason,
    };
  }

  if (progress.done) {
    const outKey = progress.outputKey;
    if (!outKey) {
      const reason = "Render finished without an output key";
      await db
        .update(projects)
        .set({
          status: "ready",
          failureReason: reason,
          exportRenderId: null,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, options.projectId));
      return {
        status: "ready",
        progress: 1,
        exportS3Key: project.exportS3Key,
        downloadUrl: await downloadFor(
          project.exportBucketName,
          project.exportS3Key,
        ),
        failureReason: reason,
      };
    }

    await db
      .update(projects)
      .set({
        status: "ready",
        exportS3Key: outKey,
        // Keep exportBucketName — downloads come from the Remotion bucket.
        failureReason: null,
        exportRenderId: null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, options.projectId));

    return {
      status: "ready",
      progress: 1,
      exportS3Key: outKey,
      downloadUrl: await exportDownloadUrl({
        bucketName: project.exportBucketName,
        objectKey: outKey,
      }),
      failureReason: null,
    };
  }

  return {
    status: "exporting",
    progress: progress.overallProgress,
    exportS3Key: project.exportS3Key,
    downloadUrl: null,
    failureReason: null,
  };
}
