import { and, eq, isNull } from "drizzle-orm";

import { projects } from "~/server/db/schema";

import type { db } from "~/server/db";
import type { Session } from "next-auth";

type Db = typeof db;

export function sessionUserId(
  session: Session | null | undefined,
): string | null {
  return session?.user?.id ?? null;
}

export function canAccessProject(
  project: { userId: string | null },
  session: Session | null | undefined,
): boolean {
  if (project.userId == null) return true;
  return session?.user?.id === project.userId;
}

export function ownerWhere(userId: string | null) {
  return userId == null ? isNull(projects.userId) : eq(projects.userId, userId);
}

/** Attach a User to an unclaimed Project. No-op if already owned. Returns whether this call claimed it. */
export async function claimUnclaimedProject(
  database: Db,
  options: { projectId: string; userId: string },
): Promise<boolean> {
  const claimed = await database
    .update(projects)
    .set({ userId: options.userId, updatedAt: new Date() })
    .where(and(eq(projects.id, options.projectId), isNull(projects.userId)))
    .returning({ id: projects.id });
  return claimed.length > 0;
}
