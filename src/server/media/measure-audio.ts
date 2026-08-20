import { ApiError, fal } from "@fal-ai/client";

import type { LoudnessProbe } from "~/domain/audio/loudness";
import { type WaveformData } from "~/domain/audio/waveform";
import { env } from "~/env";
import { signedCloudFrontUrl } from "~/server/media/cloudfront";

const MEASURE_URL_TTL_SEC = 30 * 60;
/** fal waveform API rejects values above 10. */
const FAL_WAVEFORM_POINTS_PER_SEC = 10;

/** Auth/validation failures — do not retry the workflow step. */
export class FalMeasureError extends Error {
  readonly fatal: boolean;

  constructor(message: string, options?: { fatal?: boolean; cause?: unknown }) {
    super(message);
    this.name = "FalMeasureError";
    this.fatal = options?.fatal ?? false;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export type FalJobRef = {
  endpoint: string;
  requestId: string;
  what: string;
};

export type FalJobStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";

type LoudnormSummary = {
  input_integrated?: number;
  input_true_peak?: number;
};

export type LoudnormResult = {
  summary?: LoudnormSummary;
};

export type WaveformResult = {
  waveform?: number[];
  duration?: number;
};

type MetadataResult = {
  media?: { duration?: number };
};

function configureFal(): void {
  fal.config({ credentials: env.FAL_KEY });
}

function isFatalStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 422;
}

function wrapFalError(error: unknown, what: string): never {
  if (error instanceof FalMeasureError) throw error;
  if (error instanceof ApiError) {
    const detail =
      error.body && typeof error.body === "object" && "detail" in error.body
        ? JSON.stringify((error.body as { detail: unknown }).detail)
        : "";
    throw new FalMeasureError(
      `fal ${what} failed (${error.status}): ${error.message}${detail ? ` ${detail}` : ""}`,
      { fatal: isFatalStatus(error.status) || error.isUserTimeout, cause: error },
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  throw new FalMeasureError(`fal ${what} failed: ${message}`, { cause: error });
}

async function falSubscribe<T>(
  endpoint: string,
  input: Record<string, unknown>,
  what: string,
): Promise<T> {
  configureFal();
  try {
    const result = await fal.subscribe(endpoint, { input });
    return result.data as T;
  } catch (error) {
    wrapFalError(error, what);
  }
}

/** Signed CloudFront GET URL for fal to fetch private media. */
export function measureMediaUrl(s3Key: string): string {
  return signedCloudFrontUrl(s3Key, { expiresInSec: MEASURE_URL_TTL_SEC });
}

export function falLoudnormInput(mediaUrl: string): Record<string, unknown> {
  return { audio_url: mediaUrl, print_summary: true };
}

export function falWaveformInput(mediaUrl: string): Record<string, unknown> {
  return {
    media_url: mediaUrl,
    points_per_second: FAL_WAVEFORM_POINTS_PER_SEC,
    precision: 4,
    smoothing_window: 3,
  };
}

export async function submitFalJob(
  endpoint: string,
  input: Record<string, unknown>,
  what: string,
): Promise<FalJobRef> {
  configureFal();
  try {
    const queued = await fal.queue.submit(endpoint, { input });
    return { endpoint, requestId: queued.request_id, what };
  } catch (error) {
    wrapFalError(error, `${what} submit`);
  }
}

export async function pollFalJob(job: FalJobRef): Promise<FalJobStatus> {
  configureFal();
  try {
    const queued = await fal.queue.status(job.endpoint, {
      requestId: job.requestId,
    });
    // Fal's typed status is already the success union; read as string so
    // unexpected phases (FAILED, etc.) still throw instead of narrowing to never.
    const phase = String((queued as { status: string }).status);
    if (
      phase !== "IN_QUEUE" &&
      phase !== "IN_PROGRESS" &&
      phase !== "COMPLETED"
    ) {
      throw new FalMeasureError(
        `fal ${job.what} failed (${phase || "unknown"})`,
        { fatal: true },
      );
    }
    return phase;
  } catch (error) {
    wrapFalError(error, `${job.what} poll`);
  }
}

export async function resultFalJob<T>(job: FalJobRef): Promise<T> {
  configureFal();
  try {
    const result = await fal.queue.result(job.endpoint, {
      requestId: job.requestId,
    });
    return result.data as T;
  } catch (error) {
    wrapFalError(error, `${job.what} result`);
  }
}

export function loudnessFromFal(data: LoudnormResult): LoudnessProbe {
  const lufs = data.summary?.input_integrated;
  const truePeakDb = data.summary?.input_true_peak;
  if (
    typeof lufs !== "number" ||
    !Number.isFinite(lufs) ||
    typeof truePeakDb !== "number" ||
    !Number.isFinite(truePeakDb)
  ) {
    throw new FalMeasureError("fal loudnorm returned no usable summary", {
      fatal: true,
    });
  }
  return { lufs, truePeakDb };
}

export function waveformFromFal(data: WaveformResult): WaveformData {
  const raw = data.waveform;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new FalMeasureError("fal waveform returned no samples", {
      fatal: true,
    });
  }
  const peaks = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    peaks[i] = typeof v === "number" && Number.isFinite(v) ? Math.abs(v) : 0;
  }
  return { peaks, peaksPerSec: FAL_WAVEFORM_POINTS_PER_SEC };
}

export async function probeDurationSec(mediaUrl: string): Promise<number> {
  const data = await falSubscribe<MetadataResult>(
    "fal-ai/ffmpeg-api/metadata",
    { media_url: mediaUrl, extract_frames: false },
    "metadata",
  );
  const n = data.media?.duration;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

/** Integrated LUFS + true peak. Ignores the normalized file fal also returns. */
export async function probeMediaLoudness(
  mediaUrl: string,
): Promise<LoudnessProbe> {
  const data = await falSubscribe<LoudnormResult>(
    "fal-ai/ffmpeg-api/loudnorm",
    falLoudnormInput(mediaUrl),
    "loudnorm",
  );
  return loudnessFromFal(data);
}

export async function buildWaveformFromMedia(
  mediaUrl: string,
): Promise<WaveformData> {
  const data = await falSubscribe<WaveformResult>(
    "fal-ai/ffmpeg-api/waveform",
    falWaveformInput(mediaUrl),
    "waveform",
  );
  return waveformFromFal(data);
}

export function roundLoudness(n: number, digits: number): number {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}
