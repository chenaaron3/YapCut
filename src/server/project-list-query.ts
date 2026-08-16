import { and, eq, sql, type SQL } from "drizzle-orm";

import type { ProjectListBadge } from "~/domain/project-list-badge";

import { projects } from "~/server/db/schema";

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

export function projectListWhere(options: {
  userId: string;
  query: string;
  status: ProjectListBadge | "all";
}) {
  return and(
    projectListOwned(options.userId),
    titleSearch(options.query),
    statusFilter(options.status),
  );
}
