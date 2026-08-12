import {
  AUDIO_LOUDNESS_TARGET_LUFS,
  gainFromLoudness,
} from "~/domain/audio/loudness";

/** Platform anchor — voice should sit here. */
export const AROLL_TARGET_LUFS = -14.5;

/** SFX punctuate ~6 dB below voice (target band −18 to −22). */
export const SFX_TARGET_LUFS = -20;

/** Full music bed ~14 dB below voice (target band −24 to −32). */
export const MUSIC_TARGET_LUFS = -28;

/** Library assets are normalized to this before role offsets. */
export const LIBRARY_LUFS = AUDIO_LOUDNESS_TARGET_LUFS;

/** Linear gain to reach `targetLufs` from `fromLufs`. */
export function lufsToGain(targetLufs: number, fromLufs: number): number {
  return 10 ** ((targetLufs - fromLufs) / 20);
}

/** Default SFX slider level (−20 LUFS after library normalize). */
export const SFX_VOLUME_DEFAULT = lufsToGain(SFX_TARGET_LUFS, LIBRARY_LUFS);

/** Default music bed (−28 LUFS after library normalize). */
export const MUSIC_VOLUME_DEFAULT = lufsToGain(MUSIC_TARGET_LUFS, LIBRARY_LUFS);

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

/** Mix slider × library-normalize gain (SFX / music). */
export function mixPlaybackVolume(
  mixVolume: number,
  lufs: number | null | undefined,
  truePeakDb: number | null | undefined,
): number {
  return Math.max(0, mixVolume * libraryPlaybackGain(lufs, truePeakDb));
}
