import Replicate from "replicate";

import type { TranscriptWord } from "~/domain/transcript";
import { env } from "~/env";

/**
 * WhisperX on Replicate — pin a version hash.
 * `replicate.run("owner/name")` hits `/v1/models/.../predictions` which 404s for this model;
 * versioned runs use `/v1/predictions` and work.
 * @see https://replicate.com/victor-upmeet/whisperx/versions
 */
const WHISPERX_MODEL =
  "victor-upmeet/whisperx:655845d6190ef70573c669245f245892cd039df4b880a1e3a65852c09252f5cc" as const;

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

let replicate: Replicate | null = null;

function getReplicate(): Replicate {
  replicate ??= new Replicate({ auth: env.REPLICATE_API_TOKEN });
  return replicate;
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

/**
 * Transcribe a publicly reachable audio/video URL via Replicate WhisperX.
 * Language autodetect; diarization off; word alignment on.
 */
export async function transcribeWithWhisperX(audioUrl: string): Promise<{
  words: TranscriptWord[];
  language: string | null;
  speechEndSec: number | null;
  raw: Record<string, unknown>;
}> {
  const output = await getReplicate().run(WHISPERX_MODEL, {
    input: {
      audio_file: audioUrl,
      // Omit language for autodetect
      diarization: false,
      align_output: true,
      debug: false,
    },
  });

  return normalizeWhisperXWords(output);
}
