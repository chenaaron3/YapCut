import { eq } from "drizzle-orm";

import type { MaskType } from "~/domain/asset/mask";
import { parseMaskProgress } from "~/domain/asset/mask-progress";
import { assets, masks } from "~/server/db/schema";
import { signedCloudFrontUrl } from "~/server/media/cloudfront";
import { isGlobalMusicKey, isGlobalSfxKey } from "~/server/media/keys";

import type { MaskProgressEvent } from "~/domain/asset/mask-progress";

export type ClientMask = {
  type: MaskType;
  playbackUrl: string | null;
  progress: MaskProgressEvent | null;
};

export type MaskRow = {
  type: MaskType;
  enabled: boolean;
  s3Key: string | null;
  progress: unknown;
};

export const clientMaskColumns = {
  type: masks.type,
  enabled: masks.enabled,
  s3Key: masks.s3Key,
  progress: masks.progress,
};

export const maskOnAsset = eq(masks.assetId, assets.id);

function audioLibraryOf(
  s3Key: string,
  kind: "video" | "image" | "audio",
): "sfx" | "music" | null {
  if (kind !== "audio") return null;
  if (isGlobalSfxKey(s3Key)) return "sfx";
  if (isGlobalMusicKey(s3Key)) return "music";
  return "music";
}

function toClientMask(mask: MaskRow | null | undefined): ClientMask | null {
  if (!mask?.enabled) return null;
  return {
    type: mask.type,
    playbackUrl: mask.s3Key
      ? signedCloudFrontUrl(mask.s3Key, { expiresInSec: 60 * 60 * 6 })
      : null,
    progress: parseMaskProgress(mask.progress),
  };
}

/** Sign playback; never send s3Key. Mask is a decorator, not an Asset. */
export function toClientAsset<
  T extends {
    kind: "video" | "image" | "audio";
    s3Key: string;
    waveformPeaks?: number[] | null;
    waveformPeaksPerSec?: number | null;
    mask?: MaskRow | null;
  },
>(row: T) {
  const { s3Key, waveformPeaks, waveformPeaksPerSec, mask, ...rest } = row;
  const clientMask = toClientMask(mask);
  const waveform =
    waveformPeaksPerSec != null &&
    Array.isArray(waveformPeaks) &&
    waveformPeaks.length > 0
      ? { peaksPerSec: waveformPeaksPerSec, peaks: waveformPeaks }
      : null;
  return {
    ...rest,
    playbackUrl: signedCloudFrontUrl(s3Key, { expiresInSec: 60 * 60 * 6 }),
    audioLibrary: audioLibraryOf(s3Key, row.kind),
    waveform,
    mask: clientMask,
  };
}
