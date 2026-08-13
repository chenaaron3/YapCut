import { and, asc, eq } from "drizzle-orm";

import { nextPublishAt } from "~/domain/schedule-cadence";
import {
  assertValidTimezone,
  DEFAULT_SCHEDULE_SETTINGS,
  type ScheduleSettingsInput,
} from "~/domain/schedule";
import { db } from "~/server/db";
import {
  platformPublishes,
  projects,
  scheduleEntries,
  scheduleSettings,
} from "~/server/db/schema";

export async function getOrCreateScheduleSettings(
  userId: string,
): Promise<ScheduleSettingsInput & { userId: string }> {
  const existing = await db.query.scheduleSettings.findFirst({
    where: eq(scheduleSettings.userId, userId),
  });
  if (existing) {
    return {
      userId,
      time: existing.time,
      timezone: existing.timezone,
      platforms: existing.platforms,
    };
  }

  await db.insert(scheduleSettings).values({
    userId,
    time: DEFAULT_SCHEDULE_SETTINGS.time,
    timezone: DEFAULT_SCHEDULE_SETTINGS.timezone,
    platforms: DEFAULT_SCHEDULE_SETTINGS.platforms,
  });

  return { userId, ...DEFAULT_SCHEDULE_SETTINGS };
}

export async function updateScheduleSettings(
  userId: string,
  input: ScheduleSettingsInput,
): Promise<ScheduleSettingsInput> {
  assertValidTimezone(input.timezone);
  await getOrCreateScheduleSettings(userId);
  await db
    .update(scheduleSettings)
    .set({
      time: input.time,
      timezone: input.timezone,
      platforms: input.platforms,
      updatedAt: new Date(),
    })
    .where(eq(scheduleSettings.userId, userId));
  return input;
}

export async function listScheduleQueue(userId: string) {
  return db.query.scheduleEntries.findMany({
    where: eq(scheduleEntries.userId, userId),
    orderBy: [asc(scheduleEntries.scheduledAt)],
    with: {
      project: {
        columns: {
          id: true,
          title: true,
          status: true,
          exportS3Key: true,
          coverS3Key: true,
        },
      },
      platformPublishes: true,
    },
  });
}

export async function scheduleProject(options: {
  userId: string;
  projectId: string;
}): Promise<{ entryId: string; scheduledAt: Date }> {
  const [project] = await db
    .select({
      id: projects.id,
      status: projects.status,
      exportS3Key: projects.exportS3Key,
      coverS3Key: projects.coverS3Key,
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
  if (project.status !== "ready") {
    throw new Error(`Project must be ready (status=${project.status})`);
  }
  if (!project.exportS3Key) {
    throw new Error("Export the project video before adding to schedule");
  }
  if (!project.coverS3Key) {
    throw new Error("Export must produce a Cover before adding to schedule");
  }

  const existing = await db.query.scheduleEntries.findFirst({
    where: eq(scheduleEntries.projectId, options.projectId),
  });
  if (existing) {
    throw new Error("Project is already on the schedule");
  }

  const settings = await getOrCreateScheduleSettings(options.userId);
  const others = await db
    .select({ scheduledAt: scheduleEntries.scheduledAt })
    .from(scheduleEntries)
    .where(eq(scheduleEntries.userId, options.userId));

  const scheduledAt = nextPublishAt({
    scheduledAts: others.map((o) => o.scheduledAt),
    time: settings.time,
    timezone: settings.timezone,
  });

  const [entry] = await db
    .insert(scheduleEntries)
    .values({
      userId: options.userId,
      projectId: options.projectId,
      scheduledAt,
    })
    .returning({ id: scheduleEntries.id, scheduledAt: scheduleEntries.scheduledAt });

  if (!entry) {
    throw new Error("Failed to create schedule entry");
  }

  if (settings.platforms.length > 0) {
    await db.insert(platformPublishes).values(
      settings.platforms.map((platform) => ({
        scheduleEntryId: entry.id,
        platform,
        status: "pending" as const,
      })),
    );
  }

  return { entryId: entry.id, scheduledAt: entry.scheduledAt };
}

/** ScheduleEntries that still have pending/failed PlatformPublish rows. */
export async function listIncompletePublishes(options: {
  userId: string;
  projectId?: string;
}) {
  const entries = await db.query.scheduleEntries.findMany({
    where: and(
      eq(scheduleEntries.userId, options.userId),
      options.projectId
        ? eq(scheduleEntries.projectId, options.projectId)
        : undefined,
    ),
    orderBy: [asc(scheduleEntries.scheduledAt)],
    with: {
      project: {
        columns: {
          id: true,
          title: true,
          exportS3Key: true,
          coverS3Key: true,
          exportBucketName: true,
        },
      },
      platformPublishes: true,
    },
  });

  return entries.filter((e) =>
    e.platformPublishes.some(
      (p) => p.status === "pending" || p.status === "failed",
    ),
  );
}

export async function setPlatformPublishStatus(options: {
  id: string;
  status: "pending" | "uploading" | "succeeded" | "failed";
  postUrl?: string | null;
  lastError?: string | null;
}): Promise<void> {
  await db
    .update(platformPublishes)
    .set({
      status: options.status,
      postUrl:
        options.postUrl === undefined ? undefined : options.postUrl,
      lastError:
        options.lastError === undefined ? undefined : options.lastError,
      updatedAt: new Date(),
    })
    .where(eq(platformPublishes.id, options.id));
}

export async function getScheduleEntryForProject(options: {
  userId: string;
  projectId: string;
}) {
  return db.query.scheduleEntries.findFirst({
    where: and(
      eq(scheduleEntries.userId, options.userId),
      eq(scheduleEntries.projectId, options.projectId),
    ),
    with: { platformPublishes: true },
  });
}
