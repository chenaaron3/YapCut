/** BiRefNet — video is slow; image usually finishes in a couple of polls. */
export const MASK_VIDEO_TAU_SEC = 90;
export const MASK_IMAGE_TAU_SEC = 8;

export const MASK_PROGRESS_STAGES = [
  "running",
  "ready",
  "failed",
] as const;

export type MaskProgressStage =
  (typeof MASK_PROGRESS_STAGES)[number];

/** Streamed mask-job progress (same NDJSON shape as create, different stages). */
export type MaskProgressEvent = {
  stage: MaskProgressStage;
  /** 0–1 time estimate (0→0.9 while running); fal has no percent. */
  progress: number;
  error?: string;
};

const STAGES = new Set<string>(MASK_PROGRESS_STAGES);

export function isMaskProgressEvent(
  value: unknown,
): value is MaskProgressEvent {
  if (value == null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.stage === "string" &&
    STAGES.has(v.stage) &&
    typeof v.progress === "number" &&
    Number.isFinite(v.progress)
  );
}

export function parseMaskProgress(
  value: unknown,
): MaskProgressEvent | null {
  return isMaskProgressEvent(value) ? value : null;
}

export function maskProgressEvent(
  stage: MaskProgressStage,
  progress: number,
  error?: string,
): MaskProgressEvent {
  const event: MaskProgressEvent = {
    stage,
    progress: Math.min(1, Math.max(0, progress)),
  };
  if (error) event.error = error;
  return event;
}
