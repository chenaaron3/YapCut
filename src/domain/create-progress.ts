export const CREATE_PROGRESS_STAGES = [
  "media",
  "ai_analysis",
  "ready",
  "failed",
] as const;

export type CreateProgressStage = (typeof CREATE_PROGRESS_STAGES)[number];

export type CreateProgressEvent = {
  stage: CreateProgressStage;
  label: string;
  /** 0–1 within the current stage */
  progress: number;
};

export const CREATE_STAGE_LABEL: Record<CreateProgressStage, string> = {
  media: "Transcribing audio…",
  ai_analysis: "Analyzing with AI…",
  ready: "Ready",
  failed: "Create failed",
};

/** Share of the overall bar before/at each non-terminal stage. */
export const CREATE_STAGE_WEIGHT = {
  media: 0.6,
  ai_analysis: 0.4,
} as const;

/** WhisperX vs fal within the media stage (WhisperX is slower). */
const MEDIA_TRANSCRIBE_SHARE = 0.75;
const MEDIA_MEASURE_SHARE = 0.25;

export const TRANSCRIBE_PROGRESS_TAU_SEC = 45;
export const MEASURE_PROGRESS_TAU_SEC = 15;

const STAGES = new Set<string>(CREATE_PROGRESS_STAGES);

export function isCreateProgressEvent(
  value: unknown,
): value is CreateProgressEvent {
  if (value == null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.stage === "string" &&
    STAGES.has(v.stage) &&
    typeof v.label === "string" &&
    typeof v.progress === "number" &&
    Number.isFinite(v.progress)
  );
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Estimated 0–1 for a vendor job with no percent:
 * queued 0.1, running 0.5→0.9 (time-based), done 1.
 */
export function estimateJobProgress(options: {
  phase: "queued" | "running" | "done";
  startedAtMs: number;
  nowMs: number;
  tauSec: number;
}): number {
  if (options.phase === "done") return 1;
  if (options.phase === "queued") return 0.1;
  const elapsedSec = Math.max(0, (options.nowMs - options.startedAtMs) / 1000);
  const tau = options.tauSec > 0 ? options.tauSec : 1;
  return clampProgress(0.5 + 0.4 * (1 - Math.exp(-elapsedSec / tau)));
}

/** Mean of per-item 0–1 estimates (assets, fal jobs, …). */
export function meanProgress(parts: readonly number[]): number {
  if (parts.length === 0) return 0;
  let sum = 0;
  for (const p of parts) sum += clampProgress(p);
  return clampProgress(sum / parts.length);
}

export function overallCreateProgress(event: CreateProgressEvent): number {
  if (event.stage === "ready") return 1;
  if (event.stage === "failed") {
    return clampProgress(event.progress);
  }
  const local = clampProgress(event.progress);
  if (event.stage === "media") {
    return local * CREATE_STAGE_WEIGHT.media;
  }
  return CREATE_STAGE_WEIGHT.media + local * CREATE_STAGE_WEIGHT.ai_analysis;
}

/** Combine parallel WhisperX + fal progress into the media stage. */
export function mediaProgressEvent(
  transcribe: number,
  measure: number,
): CreateProgressEvent {
  return createProgressEvent(
    "media",
    clampProgress(transcribe) * MEDIA_TRANSCRIBE_SHARE +
      clampProgress(measure) * MEDIA_MEASURE_SHARE,
  );
}

export function createProgressEvent(
  stage: CreateProgressStage,
  progress: number,
  label?: string,
): CreateProgressEvent {
  return {
    stage,
    label: label ?? CREATE_STAGE_LABEL[stage],
    progress: clampProgress(progress),
  };
}
