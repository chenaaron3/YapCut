import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { isDraftCreate } from "~/domain/project/create-draft";
import { assets, projects } from "~/server/db/schema";
import { deleteAssets } from "~/server/media/delete-assets";
import { ownerWhere } from "~/server/project/access";

import type { db } from "~/server/db";

type Db = typeof db;

export type DraftProjectRow = {
  id: string;
  status: string;
  createProgress: unknown;
  workflowRunId: string | null;
};

export async function requireDraftProject(
  database: Db,
  options: { projectId: string; userId: string | null },
): Promise<DraftProjectRow> {
  const [project] = await database
    .select({
      id: projects.id,
      status: projects.status,
      createProgress: projects.createProgress,
      workflowRunId: projects.workflowRunId,
    })
    .from(projects)
    .where(and(eq(projects.id, options.projectId), ownerWhere(options.userId)))
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

export async function deleteDraftProject(
  database: Db,
  projectId: string,
): Promise<void> {
  const rows = await database
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.projectId, projectId));
  await deleteAssets(
    database,
    rows.map((row) => row.id),
  );
  await database.delete(projects).where(eq(projects.id, projectId));
}
