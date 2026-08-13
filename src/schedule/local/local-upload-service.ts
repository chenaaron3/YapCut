import {
  ScheduleUploadService,
  type ScheduleUploadJob,
} from "~/schedule/upload-service";

/**
 * Local Schedule run: Playwright/API Publishers, serialised so the shared
 * Chrome profile is not opened twice at once.
 */
export class LocalScheduleUploadService extends ScheduleUploadService {
  private queue: Promise<void> = Promise.resolve();

  start(job: ScheduleUploadJob): void {
    this.queue = this.queue
      .then(() => this.execute(job))
      .catch((err: unknown) => {
        console.error(
          `[schedule] local upload failed for ${job.projectId}:`,
          err instanceof Error ? err.message : err,
        );
      });
  }

  private async execute(job: ScheduleUploadJob): Promise<void> {
    const [{ executeScheduleRun }, { createLocalPublishers }] =
      await Promise.all([
        import("~/schedule/execute-run"),
        import("~/schedule/local"),
      ]);

    console.log(`[schedule] local upload starting for ${job.projectId}`);
    await executeScheduleRun({
      userId: job.userId,
      projectId: job.projectId,
      createPublishers: createLocalPublishers,
    });
  }
}

export const localScheduleUploadService = new LocalScheduleUploadService();
