import { and, eq, sql } from "drizzle-orm";

import { projects } from "~/server/db/schema";

import type { ProjectListBadge } from "~/domain/project-list-badge";
import type { SQL } from "drizzle-orm";

/** Same fallback as `projectTitle`: blank titles search as "Untitled". */
function titleSearch(query: string): SQL | undefined {
  const needle = query.trim();
  if (!needle) return undefined;
  const escaped = needle.replace(/[\\%_]/g, "\\$&");
  return sql`coalesce(nullif(trim(${projects.title}), ''), 'Untitled') ilike ${`%${escaped}%`} escape '\\'`;
}

function statusFilter(status: ProjectListBadge | "all"): SQL | undefined {
  if (status === "all") return undefined;
  if (status === "creating") return eq(projects.status, "processing");
  return eq(projects.status, status);
}

export function projectListOwned(userId: string) {
  return eq(projects.userId, userId);
}

/** Hide create drafts (processing, pipeline not started). */
export function projectListNotDraft() {
  return sql`not (${projects.status} = 'processing' and ${projects.createProgress} is null and ${projects.workflowRunId} is null)`;
}

export function projectListVisible(userId: string) {
  return and(projectListOwned(userId), projectListNotDraft());
}

export function projectListWhere(options: {
  userId: string;
  query: string;
  status: ProjectListBadge | "all";
}) {
  return and(
    projectListVisible(options.userId),
    titleSearch(options.query),
    statusFilter(options.status),
  );
}
