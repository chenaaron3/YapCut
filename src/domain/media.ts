import type { MediaRef } from "~/domain/project-config";
import type { TimelineTime } from "~/domain/time";

export type { MediaRef };

/** Default linear gain when placing video overlays (muted). */
export const DEFAULT_MEDIA_VOLUME = 0;

const MIN_RANGE_SEC = 0.05;

export function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

export function mediaRefOf(ref: MediaRef): MediaRef {
  return {
    assetId: ref.assetId,
    mediaOffsetSec: ref.mediaOffsetSec,
    volume: ref.volume,
  };
}

/** Max playable seconds given media offset (null = unlimited, e.g. images). */
export function maxMediaPlaySec(args: {
  mediaOffsetSec: number;
  srcDurationSec?: number | null;
}): number | null {
  const srcDur = args.srcDurationSec;
  if (srcDur == null || !(srcDur > 0)) return null;
  return Math.max(MIN_RANGE_SEC, srcDur - args.mediaOffsetSec);
}

/** Shrink a timeline range so it does not exceed remaining source media. */
export function clampTimelineRangeToMedia(
  range: TimelineTime,
  srcDurationSec?: number | null,
  mediaOffsetSec = 0,
): TimelineTime {
  let end = Math.max(range.start + MIN_RANGE_SEC, range.end);
  const maxPlay = maxMediaPlaySec({ mediaOffsetSec, srcDurationSec });
  if (maxPlay != null && end > range.start + maxPlay) {
    end = range.start + maxPlay;
  }
  return { start: range.start, end };
}

export function withVolume<T extends MediaRef>(item: T, volume: number): T {
  return { ...item, volume: clampVolume(volume) };
}

/**
 * Clamp media offset into source duration and shrink `end` if the range
 * would exceed remaining playable media.
 */
export function withMediaOffset<
  T extends MediaRef & { start: number; end: number },
>(item: T, mediaOffsetSec: number, srcDurationSec: number | null): T {
  if (srcDurationSec == null || !(srcDurationSec > 0)) return item;
  const maxOffset = Math.max(0, srcDurationSec - MIN_RANGE_SEC);
  const offset = Math.min(Math.max(0, mediaOffsetSec), maxOffset);
  const maxPlay = Math.max(MIN_RANGE_SEC, srcDurationSec - offset);
  const play = item.end - item.start;
  const end = play > maxPlay ? item.start + maxPlay : item.end;
  return {
    ...item,
    mediaOffsetSec: offset,
    end,
  };
}
