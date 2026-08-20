import { estimateJobProgress } from "~/domain/project/create-progress";

import type { FalJobStatus } from "~/server/media/measure-audio";

export function falJobProgress(
  status: FalJobStatus,
  startedAtMs: number,
  nowMs: number,
  tauSec: number,
): number {
  if (status === "COMPLETED") return 1;
  return estimateJobProgress({
    phase: status === "IN_PROGRESS" ? "running" : "queued",
    startedAtMs,
    nowMs,
    tauSec,
  });
}

export function replicateJobProgress(
  status: string,
  startedAtMs: number,
  nowMs: number,
  tauSec: number,
): number {
  if (status === "succeeded") return 1;
  return estimateJobProgress({
    phase: status === "processing" ? "running" : "queued",
    startedAtMs,
    nowMs,
    tauSec,
  });
}
