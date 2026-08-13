import type { PlatformId } from "~/domain/schedule";
import { formatLocalSlot } from "~/domain/schedule-cadence";
import { exportDownloadUrl } from "~/server/export/download-url";
import {
  getOrCreateScheduleSettings,
  listIncompletePublishes,
  setPlatformPublishStatus,
} from "~/server/schedule/service";
import type { PublishJob, Publisher } from "~/schedule/publisher";

export type CreatePublishers = (
  platforms: PlatformId[],
  timezone: string,
) => Publisher[];

export type ExecuteScheduleRunOptions = {
  userId: string;
  projectId?: string;
  platformsOverride?: PlatformId[];
  createPublishers: CreatePublishers;
};

async function runPublisher(
  publisher: Publisher,
  job: PublishJob,
  platformPublishId: string,
): Promise<void> {
  await setPlatformPublishStatus({
    id: platformPublishId,
    status: "uploading",
    lastError: null,
  });
  try {
    console.log(`[schedule] → ${publisher.id}`);
    const result = await publisher.publish(job);
    if (!result.url) {
      throw new Error(`${publisher.id} returned no post link`);
    }
    await setPlatformPublishStatus({
      id: platformPublishId,
      status: "succeeded",
      postUrl: result.url,
      lastError: null,
    });
    console.log(`[schedule] ${publisher.id} ok → ${result.url}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[schedule] ${publisher.id} failed: ${message}`);
    await setPlatformPublishStatus({
      id: platformPublishId,
      status: "failed",
      lastError: message,
    });
    throw err;
  }
}

/** Shared Schedule run: due/incomplete PlatformPublish rows → Publishers. */
export async function executeScheduleRun(
  options: ExecuteScheduleRunOptions,
): Promise<void> {
  const { userId, projectId, platformsOverride, createPublishers } = options;
  const settings = await getOrCreateScheduleSettings(userId);
  const timezone = settings.timezone;

  const incomplete = await listIncompletePublishes({
    userId,
    projectId,
  });

  if (incomplete.length === 0) {
    console.log("[schedule] no incomplete uploads");
    return;
  }

  console.log(
    `[schedule] ${incomplete.length} entry(ies); timezone=${timezone}`,
  );

  const failures: string[] = [];

  for (const entry of incomplete) {
    const { project } = entry;
    const pending = entry.platformPublishes.filter(
      (p) => p.status === "pending" || p.status === "failed",
    );

    if (!project.exportS3Key || !project.coverS3Key || !project.exportBucketName) {
      console.error(
        `[schedule] ${entry.projectId} missing export/cover — skip`,
      );
      failures.push(`${entry.projectId}: missing export or cover`);
      continue;
    }

    const platforms = (
      platformsOverride ?? pending.map((p) => p.platform)
    ).filter((p) => pending.some((row) => row.platform === p));

    if (platforms.length === 0) {
      console.log(`[schedule] ${entry.projectId} nothing to run`);
      continue;
    }

    const title = project.title?.trim() || "Untitled";
    console.log(
      `\n[schedule] ── ${title} (${entry.projectId}) @ ${formatLocalSlot(entry.scheduledAt, timezone)} ──`,
    );

    const videoUrl = await exportDownloadUrl({
      bucketName: project.exportBucketName,
      objectKey: project.exportS3Key,
    });
    const coverUrl = await exportDownloadUrl({
      bucketName: project.exportBucketName,
      objectKey: project.coverS3Key,
    });

    const jobBase = {
      title,
      publishAt: entry.scheduledAt,
      video: { url: videoUrl, contentType: "video/mp4" },
      cover: { url: coverUrl, contentType: "image/jpeg" },
    };

    const publishers = createPublishers(platforms, timezone);

    await Promise.all(
      publishers.map(async (publisher) => {
        const row = pending.find((p) => p.platform === publisher.id);
        if (!row) return;
        try {
          await runPublisher(
            publisher,
            { ...jobBase, platform: publisher.id },
            row.id,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          failures.push(`${entry.projectId}/${publisher.id}: ${message}`);
        }
      }),
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `Finished with failures. Re-run to retry.\n` +
        failures.map((f) => `  - ${f}`).join("\n"),
    );
  }
  console.log("[schedule] done");
}
