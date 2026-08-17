import { meanProgress, mediaProgressEvent } from "~/domain/create-progress";

import type { CreateProgressEvent } from "~/domain/create-progress";

/** Serializable A-roll ref passed across workflow `sleep()` / steps. */
export type CreateAssetRef = {
  id: string;
  s3Key: string;
  originalFilename: string | null;
  durationSec: number;
};

export type WhisperXHandle = {
  predictionId: string;
  startedAtMs: number;
};

export type MeasureJobSetRef = {
  assetId: string;
  loudnorm: { endpoint: string; requestId: string; what: string };
  waveform: { endpoint: string; requestId: string; what: string };
};

export type MeasureHandle = {
  jobSet: MeasureJobSetRef;
  startedAtMs: number;
};

export type PendingJob<Handle> = {
  asset: CreateAssetRef;
  index: number;
  handle: Handle;
};

export type JobPollResult = {
  index: number;
  progress: number;
  status: "pending" | "done" | "failed";
  error?: string;
};

/**
 * One remote create job type (WhisperX, fal measure, …).
 *
 * `start` / `poll` / `finish` / `fail` do I/O. The workflow binds those
 * through `"use step"` via `withJobIO` so Node I/O never loads in the
 * workflow isolate. `start` returns `null` when the asset is already done.
 */
export type CreateJob<Handle> = {
  name: string;
  start(asset: CreateAssetRef): Promise<Handle | null>;
  poll(
    jobs: Array<{ index: number; handle: Handle }>,
  ): Promise<JobPollResult[]>;
  finish(asset: CreateAssetRef, handle: Handle): Promise<void>;
  fail?(asset: CreateAssetRef, reason: string): Promise<void>;
};

export type CreateJobIO<Handle> = Pick<
  CreateJob<Handle>,
  "start" | "poll" | "finish"
> &
  Pick<Partial<CreateJob<Handle>>, "fail">;

export function createAssetLabel(asset: CreateAssetRef): string {
  return asset.originalFilename ?? asset.id;
}

function pendingLabels<Handle>(pending: PendingJob<Handle>[]): string {
  return pending.map((item) => createAssetLabel(item.asset)).join(", ");
}

/** Bind step I/O under a job name without importing the Node job module. */
export function withJobIO<Handle>(
  name: string,
  io: CreateJobIO<Handle>,
): CreateJob<Handle> {
  return { name, ...io };
}

export type CreateJobCancel = {
  cancelled: boolean;
};

/** Merge WhisperX + fal progress so parallel jobs don't clobber the bar. */
export function createMediaProgressGate(input: {
  publish: (event: CreateProgressEvent) => Promise<void>;
  cancel: CreateJobCancel;
}): {
  onTranscribe: (progress: number) => Promise<void>;
  onMeasure: (progress: number) => Promise<void>;
} {
  const parts = { transcribe: 0, measure: 0 };
  let queue = Promise.resolve();

  const report = (key: "transcribe" | "measure") => {
    return async (progress: number) => {
      if (input.cancel.cancelled) return;
      parts[key] = progress;
      const snapshot = {
        transcribe: parts.transcribe,
        measure: parts.measure,
      };
      queue = queue.then(async () => {
        if (input.cancel.cancelled) return;
        await input.publish(
          mediaProgressEvent(snapshot.transcribe, snapshot.measure),
        );
      });
      await queue;
    };
  };

  return {
    onTranscribe: report("transcribe"),
    onMeasure: report("measure"),
  };
}

export async function settleMediaJobs(
  whisper: Promise<void>,
  measure: Promise<void>,
): Promise<void> {
  const results = await Promise.allSettled([whisper, measure]);
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failed) throw failed.reason;
}

export async function runCreateJobs<Handle>(input: {
  job: CreateJob<Handle>;
  assets: CreateAssetRef[];
  maxPolls: number;
  sleep: () => Promise<void>;
  onProgress: (progress: number) => Promise<void>;
  cancel?: CreateJobCancel;
}): Promise<void> {
  const { job, assets, maxPolls, sleep, onProgress, cancel } = input;
  const stopped = () => cancel?.cancelled === true;
  const stop = () => {
    if (cancel) cancel.cancelled = true;
  };

  const progress = assets.map(() => 0);
  await onProgress(meanProgress(progress));
  if (stopped()) return;

  const starts = await Promise.all(assets.map((asset) => job.start(asset)));
  if (stopped()) return;
  let pending: PendingJob<Handle>[] = [];
  for (let index = 0; index < assets.length; index++) {
    const handle = starts[index];
    if (handle == null) {
      progress[index] = 1;
      continue;
    }
    pending.push({
      asset: assets[index]!,
      index,
      handle,
    });
  }
  await onProgress(meanProgress(progress));

  for (let p = 0; p < maxPolls && pending.length > 0; p++) {
    if (stopped()) return;
    const polls = await job.poll(
      pending.map((item) => ({ index: item.index, handle: item.handle })),
    );
    if (stopped()) return;
    const byIndex = new Map(polls.map((poll) => [poll.index, poll]));

    for (const item of pending) {
      const poll = byIndex.get(item.index)!;
      progress[item.index] = poll.progress;
      if (poll.status !== "failed") continue;
      const reason = poll.error ?? `${job.name} failed`;
      stop();
      await job.fail?.(item.asset, reason);
      throw new Error(
        `${job.name} failed for ${createAssetLabel(item.asset)}: ${reason}`,
      );
    }
    await onProgress(meanProgress(progress));

    const done = pending.filter(
      (item) => byIndex.get(item.index)!.status === "done",
    );
    for (const item of done) {
      if (stopped()) return;
      await job.finish(item.asset, item.handle);
      progress[item.index] = 1;
    }
    if (done.length > 0) {
      await onProgress(meanProgress(progress));
    }

    pending = pending.filter(
      (item) => byIndex.get(item.index)!.status !== "done",
    );
    if (pending.length > 0) await sleep();
  }

  if (stopped()) return;
  if (pending.length > 0) {
    const reason = `${job.name} timed out`;
    stop();
    for (const item of pending) {
      await job.fail?.(item.asset, reason);
    }
    throw new Error(`${reason} for ${pendingLabels(pending)}`);
  }
}
