/**
 * Port for kicking off platform uploads after a ScheduleEntry is created.
 *
 * Swap the implementation in `getScheduleUploadService()` — local Playwright
 * run today, another upload backend later. `start` must return immediately.
 */
export type ScheduleUploadJob = {
  userId: string;
  projectId: string;
  entryId: string;
  scheduledAt: Date;
};

export abstract class ScheduleUploadService {
  abstract start(job: ScheduleUploadJob): void;
}

export class NoopScheduleUploadService extends ScheduleUploadService {
  start(_job: ScheduleUploadJob): void {
    void _job;
  }
}

class DevScheduleUploadService extends ScheduleUploadService {
  start(job: ScheduleUploadJob): void {
    void import("~/schedule/local/local-upload-service")
      .then(({ localScheduleUploadService }) => {
        localScheduleUploadService.start(job);
      })
      .catch((err: unknown) => {
        console.error(
          "[schedule] failed to load local upload service:",
          err instanceof Error ? err.message : err,
        );
      });
  }
}

let instance: ScheduleUploadService | undefined;

/** Local Playwright run in development; no-op on Vercel / production. */
export function getScheduleUploadService(): ScheduleUploadService {
  if (!instance) {
    instance =
      process.env.NODE_ENV === "development"
        ? new DevScheduleUploadService()
        : new NoopScheduleUploadService();
  }
  return instance;
}
