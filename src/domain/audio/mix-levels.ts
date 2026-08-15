import {
  AUDIO_LOUDNESS_TARGET_LUFS,
  gainFromLoudness,
} from "~/domain/audio/loudness";

/** Platform anchor — voice should sit here. */
export const AROLL_TARGET_LUFS = -14.5;

/** SFX punctuate ~10 dB below voice (target band −22 to −26). */
export const SFX_TARGET_LUFS = -24;

/** Full music bed ~14 dB below voice (target band −24 to −32). */
export const MUSIC_TARGET_LUFS = -28;

/** Library assets are normalized to this before role offsets. */
export const LIBRARY_LUFS = AUDIO_LOUDNESS_TARGET_LUFS;

/** Mix slider: 1 = role-calibrated level, 2 = double. */
export const MIX_SLIDER_NEUTRAL = 1;
export const MIX_SLIDER_MAX = 2;

/** Linear gain to reach `targetLufs` from `fromLufs`. */
export function lufsToGain(targetLufs: number, fromLufs: number): number {
  return 10 ** ((targetLufs - fromLufs) / 20);
}

/** SFX mix at 100% slider (−24 LUFS after library normalize). */
export const SFX_VOLUME_DEFAULT = lufsToGain(SFX_TARGET_LUFS, LIBRARY_LUFS);

/** Music bed at 100% slider (−28 LUFS after library normalize). */
export const MUSIC_VOLUME_DEFAULT = lufsToGain(MUSIC_TARGET_LUFS, LIBRARY_LUFS);

/** Slider 0–2 from stored linear mix. Values above 200% clamp to max. */
export function mixSliderOf(volume: number, roleDefault: number): number {
  if (!(roleDefault > 0) || !Number.isFinite(volume)) return 0;
  return Math.min(MIX_SLIDER_MAX, Math.max(0, volume / roleDefault));
}

/** Stored linear mix from slider 0–2. */
export function volumeFromMixSlider(
  slider: number,
  roleDefault: number,
): number {
  if (!(roleDefault > 0) || !Number.isFinite(slider)) return 0;
  return Math.min(MIX_SLIDER_MAX, Math.max(0, slider)) * roleDefault;
}

/** Clamp a stored mix to the 0–200% slider range. */
export function clampMixVolume(volume: number, roleDefault: number): number {
  return volumeFromMixSlider(mixSliderOf(volume, roleDefault), roleDefault);
}

export function libraryPlaybackGain(
  lufs: number | null | undefined,
  truePeakDb: number | null | undefined,
): number {
  return gainFromLoudness(lufs, truePeakDb, LIBRARY_LUFS);
}

export function arollPlaybackGain(
  lufs: number | null | undefined,
  truePeakDb: number | null | undefined,
): number {
  return gainFromLoudness(lufs, truePeakDb, AROLL_TARGET_LUFS);
}

/** Mix slider × library-normalize gain. `roleDefault` caps the slider at 200%. */
export function mixPlaybackVolume(
  mixVolume: number,
  lufs: number | null | undefined,
  truePeakDb: number | null | undefined,
  roleDefault: number,
): number {
  return Math.max(
    0,
    clampMixVolume(mixVolume, roleDefault) *
      libraryPlaybackGain(lufs, truePeakDb),
  );
}

/** SFX mix at the SFX role default (100% = under voice). */
export function sfxPlaybackVolume(
  mixVolume: number,
  lufs: number | null | undefined,
  truePeakDb: number | null | undefined,
): number {
  return mixPlaybackVolume(
    mixVolume,
    lufs,
    truePeakDb,
    SFX_VOLUME_DEFAULT,
  );
}
