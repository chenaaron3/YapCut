import { mediaProgressEvent } from "~/domain/project/create-progress";

import type { CreateProgressEvent } from "~/domain/project/create-progress";
import type { JobCancel } from "~/server/workflow/job";

/** Merge WhisperX + fal progress so parallel jobs don't clobber the bar. */
export function createMediaProgressGate(input: {
  publish: (event: CreateProgressEvent) => Promise<void>;
  cancel: JobCancel;
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
