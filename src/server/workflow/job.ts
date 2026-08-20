import { meanProgress } from "~/domain/project/create-progress";

export type JobItem = {
  id: string;
  originalFilename?: string | null;
};

export type PendingJob<Handle, Item extends JobItem = JobItem> = {
  item: Item;
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
 * One remote job type (WhisperX, fal measure, mask, …).
 *
 * `start` / `poll` / `finish` / `fail` do I/O. The workflow binds those
 * through `"use step"` wrappers that *call* the step by name — assigning a
 * step function onto an object is not callable in the workflow isolate.
 * `start` returns `null` when the item is already done.
 */
export type Job<Handle, Item extends JobItem = JobItem> = {
  name: string;
  start(item: Item): Promise<Handle | null>;
  poll(
    jobs: Array<{ index: number; handle: Handle }>,
  ): Promise<JobPollResult[]>;
  finish(item: Item, handle: Handle): Promise<void>;
  fail?(item: Item, reason: string): Promise<void>;
};

export function jobItemLabel(item: JobItem): string {
  return item.originalFilename ?? item.id;
}

function pendingLabels<Handle, Item extends JobItem>(
  pending: PendingJob<Handle, Item>[],
): string {
  return pending.map((entry) => jobItemLabel(entry.item)).join(", ");
}

export type JobCancel = {
  cancelled: boolean;
};

export async function runJobs<Handle, Item extends JobItem>(input: {
  job: Job<Handle, Item>;
  items: Item[];
  maxPolls: number;
  sleep: () => Promise<void>;
  onProgress: (progress: number) => Promise<void>;
  cancel?: JobCancel;
}): Promise<void> {
  const { job, items, maxPolls, sleep, onProgress, cancel } = input;
  const { name, start, poll, finish, fail } = job;
  const stopped = () => cancel?.cancelled === true;
  const stop = () => {
    if (cancel) cancel.cancelled = true;
  };

  const progress = items.map(() => 0);
  await onProgress(meanProgress(progress));
  if (stopped()) return;

  // Free-function calls so a workflow step proxy is not invoked as a method
  // (`job.start` would serialize `this` and is not a function after replay).
  const starts = await Promise.all(items.map((item) => start(item)));
  if (stopped()) return;
  let pending: PendingJob<Handle, Item>[] = [];
  for (let index = 0; index < items.length; index++) {
    const handle = starts[index];
    if (handle == null) {
      progress[index] = 1;
      continue;
    }
    pending.push({
      item: items[index]!,
      index,
      handle,
    });
  }
  await onProgress(meanProgress(progress));

  for (let p = 0; p < maxPolls && pending.length > 0; p++) {
    if (stopped()) return;
    const polls = await poll(
      pending.map((entry) => ({ index: entry.index, handle: entry.handle })),
    );
    if (stopped()) return;
    const byIndex = new Map(polls.map((entry) => [entry.index, entry]));

    for (const entry of pending) {
      const result = byIndex.get(entry.index)!;
      progress[entry.index] = result.progress;
      if (result.status !== "failed") continue;
      const reason = result.error ?? `${name} failed`;
      stop();
      await fail?.(entry.item, reason);
      throw new Error(
        `${name} failed for ${jobItemLabel(entry.item)}: ${reason}`,
      );
    }
    await onProgress(meanProgress(progress));

    const done = pending.filter(
      (entry) => byIndex.get(entry.index)!.status === "done",
    );
    for (const entry of done) {
      if (stopped()) return;
      await finish(entry.item, entry.handle);
      progress[entry.index] = 1;
    }
    if (done.length > 0) {
      await onProgress(meanProgress(progress));
    }

    pending = pending.filter(
      (entry) => byIndex.get(entry.index)!.status !== "done",
    );
    if (pending.length > 0) await sleep();
  }

  if (stopped()) return;
  if (pending.length > 0) {
    const reason = `${name} timed out`;
    stop();
    for (const entry of pending) {
      await fail?.(entry.item, reason);
    }
    throw new Error(`${reason} for ${pendingLabels(pending)}`);
  }
}
