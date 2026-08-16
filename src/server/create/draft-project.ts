import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { assets, projects } from "~/server/db/schema";
import { deleteObject } from "~/server/media/s3";

import type { db } from "~/server/db";

type Db = typeof db;

export type DraftProjectRow = {
  id: string;
  status: string;
  createProgress: unknown;
  workflowRunId: string | null;
};

/** Project exists but the create pipeline has not started. */
export function isDraftCreate(project: DraftProjectRow): boolean {
  return (
    project.status === "processing" &&
    project.createProgress == null &&
    project.workflowRunId == null
  );
}

export async function requireDraftProject(
  database: Db,
  options: { projectId: string; userId: string },
): Promise<DraftProjectRow> {
  const [project] = await database
    .select({
      id: projects.id,
      status: projects.status,
      createProgress: projects.createProgress,
      workflowRunId: projects.workflowRunId,
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
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }

  if (!isDraftCreate(project)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Project create has already started",
    });
  }

  return project;
}

export async function deleteAssetObjects(
  rows: Array<{ s3Key: string }>,
): Promise<void> {
  for (const row of rows) {
    try {
      await deleteObject(row.s3Key);
    } catch (error) {
      console.warn(
        `[create] S3 delete failed for ${row.s3Key}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export async function deleteDraftProject(
  database: Db,
  projectId: string,
): Promise<void> {
  const rows = await database
    .select({ s3Key: assets.s3Key })
    .from(assets)
    .where(eq(assets.projectId, projectId));
  await deleteAssetObjects(rows);
  await database.delete(projects).where(eq(projects.id, projectId));
}
