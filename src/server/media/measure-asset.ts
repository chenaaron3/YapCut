import { eq } from "drizzle-orm";

import { serializeWaveform } from "~/domain/audio/waveform";
import { db } from "~/server/db";
import { assets } from "~/server/db/schema";
import {
  FalMeasureError,
  type FalJobRef,
  type LoudnormResult,
  type WaveformResult,
  buildWaveformFromMedia,
  falLoudnormInput,
  falWaveformInput,
  loudnessFromFal,
  measureMediaUrl,
  pollFalJob,
  probeMediaLoudness,
  resultFalJob,
  roundLoudness,
  submitFalJob,
  waveformFromFal,
} from "~/server/media/measure-audio";

export type MeasureAssetOptions = {
  /** Remeasure even when LUFS is already stored. */
  force?: boolean;
  /** Also extract A-roll peak envelope. */
  waveform?: boolean;
};

/** Serializable fal queue ids for workflow sleep/poll. */
export type MeasureJobSet = {
  assetId: string;
  loudnorm: FalJobRef;
  waveform: FalJobRef;
};

const NETWORK_ATTEMPTS = 2;

async function withNetworkRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < NETWORK_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof FalMeasureError && error.fatal) throw error;
      last = error;
    }
  }
  throw last;
}

function hasStoredLufs(lufs: number | null | undefined): boolean {
  return lufs != null && Number.isFinite(lufs);
}

function hasStoredWaveform(peaks: number[] | null | undefined): boolean {
  return Array.isArray(peaks) && peaks.length > 0;
}

/**
 * Blocking measure for tRPC / seeds / in-process create (`fal.subscribe`).
 * Skips work that is already stored unless `force`.
 */
export async function measureAsset(
  asset: {
    id: string;
    s3Key: string;
    lufs?: number | null;
    waveformPeaks?: number[] | null;
  },
  options: MeasureAssetOptions = {},
): Promise<void> {
  const needLoudness = Boolean(options.force) || !hasStoredLufs(asset.lufs);
  const needWaveform =
    Boolean(options.waveform) &&
    (Boolean(options.force) || !hasStoredWaveform(asset.waveformPeaks));
  if (!needLoudness && !needWaveform) return;

  const inputUrl = measureMediaUrl(asset.s3Key);
  const patch: {
    lufs?: number;
    truePeakDb?: number;
    waveformPeaksPerSec?: number;
    waveformPeaks?: number[];
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (needLoudness) {
    const probe = await withNetworkRetry(() => probeMediaLoudness(inputUrl));
    patch.lufs = roundLoudness(probe.lufs, 2);
    patch.truePeakDb = roundLoudness(probe.truePeakDb, 2);
  }

  if (needWaveform) {
    const waveform = await withNetworkRetry(() =>
      buildWaveformFromMedia(inputUrl),
    );
    const serialized = serializeWaveform(waveform);
    patch.waveformPeaksPerSec = serialized.peaksPerSec;
    patch.waveformPeaks = serialized.peaks;
  }

  await db.update(assets).set(patch).where(eq(assets.id, asset.id));
}

/** Enqueue loudnorm + waveform. Does not wait for fal. */
export async function startMeasureAssetJobs(asset: {
  id: string;
  s3Key: string;
}): Promise<MeasureJobSet> {
  const inputUrl = measureMediaUrl(asset.s3Key);
  const [loudnorm, waveform] = await Promise.all([
    submitFalJob(
      "fal-ai/ffmpeg-api/loudnorm",
      falLoudnormInput(inputUrl),
      "loudnorm",
    ),
    submitFalJob(
      "fal-ai/ffmpeg-api/waveform",
      falWaveformInput(inputUrl),
      "waveform",
    ),
  ]);
  return { assetId: asset.id, loudnorm, waveform };
}

export async function pollMeasureAssetJobs(
  jobs: MeasureJobSet,
): Promise<{ done: boolean }> {
  const [loudnorm, waveform] = await Promise.all([
    pollFalJob(jobs.loudnorm),
    pollFalJob(jobs.waveform),
  ]);
  console.log(
    `[create] fal poll asset=${jobs.assetId} loudnorm=${loudnorm} waveform=${waveform}`,
  );
  return { done: loudnorm === "COMPLETED" && waveform === "COMPLETED" };
}

export async function finishMeasureAssetJobs(
  jobs: MeasureJobSet,
): Promise<void> {
  const [loudData, waveData] = await Promise.all([
    resultFalJob<LoudnormResult>(jobs.loudnorm),
    resultFalJob<WaveformResult>(jobs.waveform),
  ]);
  const probe = loudnessFromFal(loudData);
  const waveform = waveformFromFal(waveData);
  const serialized = serializeWaveform(waveform);
  await db
    .update(assets)
    .set({
      lufs: roundLoudness(probe.lufs, 2),
      truePeakDb: roundLoudness(probe.truePeakDb, 2),
      waveformPeaksPerSec: serialized.peaksPerSec,
      waveformPeaks: serialized.peaks,
      updatedAt: new Date(),
    })
    .where(eq(assets.id, jobs.assetId));
}
