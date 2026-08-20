import { MUSIC_VOLUME_DEFAULT } from "~/domain/audio/mix-levels";
import type { MusicBed } from "~/domain/project/project-config";

export const MUSIC_FADE_IN_SEC = 0.5;
export const MUSIC_FADE_OUT_SEC = 1;

export function musicFromAsset(assetId: string): MusicBed {
  return {
    assetId,
    volume: MUSIC_VOLUME_DEFAULT,
    mediaOffsetSec: 0,
  };
}

/**
 * Edge fades only (no ducking). 1 at the bed, 0 at the very start/end.
 */
export function musicFadeAtFrame(options: {
  frame: number;
  durationInFrames: number;
  fps: number;
  fadeInSec?: number;
  fadeOutSec?: number;
}): number {
  const {
    frame,
    durationInFrames,
    fps,
    fadeInSec = MUSIC_FADE_IN_SEC,
    fadeOutSec = MUSIC_FADE_OUT_SEC,
  } = options;
  if (durationInFrames <= 0) return 0;

  const fadeInFrames = Math.max(1, Math.round(fadeInSec * fps));
  const fadeOutFrames = Math.max(1, Math.round(fadeOutSec * fps));
  let fade = 1;
  if (frame < fadeInFrames) {
    fade = Math.min(fade, frame / fadeInFrames);
  }
  const framesFromEnd = durationInFrames - 1 - frame;
  if (framesFromEnd < fadeOutFrames) {
    fade = Math.min(fade, Math.max(0, framesFromEnd / fadeOutFrames));
  }
  return fade;
}
