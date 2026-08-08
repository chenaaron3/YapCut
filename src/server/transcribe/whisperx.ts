import Replicate from "replicate";

import type { TranscriptWord } from "~/domain/transcript";
import { env } from "~/env";

/**
 * WhisperX on Replicate — pin a version hash.
 * `replicate.run("owner/name")` hits `/v1/models/.../predictions` which 404s for this model;
 * versioned runs use `/v1/predictions` and work.
 * @see https://replicate.com/victor-upmeet/whisperx/versions
 */
const WHISPERX_VERSION =
  "655845d6190ef70573c669245f245892cd039df4b880a1e3a65852c09252f5cc" as const;

type WhisperXWord = {
  word?: string;
  text?: string;
  start?: number;
  end?: number;
};

type WhisperXSegment = {
  start?: number;
  end?: number;
  text?: string;
  words?: WhisperXWord[];
};

type WhisperXOutput = {
  detected_language?: string;
  segments?: WhisperXSegment[];
};

export type WhisperXPredictionStatus =
  | "starting"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled"
  | "aborted";

let replicate: Replicate | null = null;

function getReplicate(): Replicate {
  replicate ??= new Replicate({ auth: env.REPLICATE_API_TOKEN });
  return replicate;
}

function whisperXInput(audioUrl: string) {
  return {
    audio_file: audioUrl,
    // Omit language for autodetect
    diarization: false,
    align_output: true,
    debug: false,
  };
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Normalize WhisperX segments into flat TranscriptWord[]. */
export function normalizeWhisperXWords(output: unknown): {
  words: TranscriptWord[];
  language: string | null;
  /** Last speech end — not media duration (trailing silence is excluded). */
  speechEndSec: number | null;
  raw: Record<string, unknown>;
} {
  const data = (output ?? {}) as WhisperXOutput;
  const segments = Array.isArray(data.segments) ? data.segments : [];
  const words: TranscriptWord[] = [];
  let speechEndSec = 0;

  for (const segment of segments) {
    const segWords = Array.isArray(segment.words) ? segment.words : [];
    if (segWords.length > 0) {
      for (const w of segWords) {
        const text = String(w.word ?? w.text ?? "").trim();
        const start = asNumber(w.start);
        const end = asNumber(w.end);
        if (!text || start == null || end == null) continue;
        if (end < start) continue;
        words.push({ text, start, end });
        speechEndSec = Math.max(speechEndSec, end);
      }
      continue;
    }

    // Fallback: segment-level timing when word alignment missing
    const text = String(segment.text ?? "").trim();
    const start = asNumber(segment.start);
    const end = asNumber(segment.end);
    if (!text || start == null || end == null || end < start) continue;
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const span = end - start;
    const step = span / tokens.length;
    for (let i = 0; i < tokens.length; i++) {
      const tStart = start + i * step;
      const tEnd = i === tokens.length - 1 ? end : start + (i + 1) * step;
      words.push({ text: tokens[i]!, start: tStart, end: tEnd });
    }
    speechEndSec = Math.max(speechEndSec, end);
  }

  words.sort((a, b) => a.start - b.start);

  return {
    words,
    language:
      typeof data.detected_language === "string"
        ? data.detected_language
        : null,
    speechEndSec: speechEndSec > 0 ? speechEndSec : null,
    raw: {
      detected_language: data.detected_language ?? null,
      segmentCount: segments.length,
      wordCount: words.length,
    },
  };
}

/** Start WhisperX without waiting (for durable workflow polling). */
export async function startWhisperXPrediction(
  audioUrl: string,
): Promise<{ predictionId: string }> {
  const prediction = await getReplicate().predictions.create({
    version: WHISPERX_VERSION,
    input: whisperXInput(audioUrl),
  });
  if (!prediction.id) {
    throw new Error("Replicate prediction missing id");
  }
  return { predictionId: prediction.id };
}

/** One poll of a WhisperX prediction — does not block until complete. */
export async function getWhisperXPrediction(predictionId: string): Promise<{
  status: WhisperXPredictionStatus;
  error: string | null;
  result: ReturnType<typeof normalizeWhisperXWords> | null;
}> {
  const prediction = await getReplicate().predictions.get(predictionId);
  const status = prediction.status as WhisperXPredictionStatus;

  if (status === "succeeded") {
    return {
      status,
      error: null,
      result: normalizeWhisperXWords(prediction.output),
    };
  }

  if (
    status === "failed" ||
    status === "canceled" ||
    status === "aborted"
  ) {
    const error =
      typeof prediction.error === "string" && prediction.error.length > 0
        ? prediction.error
        : `WhisperX ${status}`;
    return { status, error, result: null };
  }

  return { status, error: null, result: null };
}

/**
 * Transcribe a publicly reachable audio/video URL via Replicate WhisperX.
 * Blocks until complete — for local / in-process create only.
 */
export async function transcribeWithWhisperX(audioUrl: string): Promise<{
  words: TranscriptWord[];
  language: string | null;
  speechEndSec: number | null;
  raw: Record<string, unknown>;
}> {
  const prediction = await getReplicate().predictions.create({
    version: WHISPERX_VERSION,
    input: whisperXInput(audioUrl),
  });
  const completed = await getReplicate().wait(prediction);

  if (completed.status !== "succeeded") {
    const error =
      typeof completed.error === "string" && completed.error.length > 0
        ? completed.error
        : `WhisperX ${completed.status}`;
    throw new Error(error);
  }

  return normalizeWhisperXWords(completed.output);
}
