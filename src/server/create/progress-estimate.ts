import {
  createProgressEvent,
  estimateJobProgress,
  meanProgress,
  MEASURE_PROGRESS_TAU_SEC,
  TRANSCRIBE_PROGRESS_TAU_SEC,
} from "~/domain/create-progress";

import type { CreateProgressEvent } from "~/domain/create-progress";
import type { FalJobStatus } from "~/server/media/measure-audio";

export function whisperJobProgress(
  status: string,
  startedAtMs: number,
  nowMs: number,
): number {
  if (status === "succeeded") return 1;
  if (status === "processing") {
    return estimateJobProgress({
      phase: "running",
      startedAtMs,
      nowMs,
      tauSec: TRANSCRIBE_PROGRESS_TAU_SEC,
    });
  }
  return estimateJobProgress({
    phase: "queued",
    startedAtMs,
    nowMs,
    tauSec: TRANSCRIBE_PROGRESS_TAU_SEC,
  });
}

export function falJobProgress(
  status: FalJobStatus,
  startedAtMs: number,
  nowMs: number,
): number {
  if (status === "COMPLETED") return 1;
  if (status === "IN_PROGRESS") {
    return estimateJobProgress({
      phase: "running",
      startedAtMs,
      nowMs,
      tauSec: MEASURE_PROGRESS_TAU_SEC,
    });
  }
  return estimateJobProgress({
    phase: "queued",
    startedAtMs,
    nowMs,
    tauSec: MEASURE_PROGRESS_TAU_SEC,
  });
}

export function transcribeStageEvent(
  assetProgress: readonly number[],
): CreateProgressEvent {
  return createProgressEvent("transcribe", meanProgress(assetProgress));
}

export function measureStageEvent(
  assetProgress: readonly number[],
): CreateProgressEvent {
  return createProgressEvent("measure", meanProgress(assetProgress));
}
