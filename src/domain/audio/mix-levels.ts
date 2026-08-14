import {
  AUDIO_LOUDNESS_MAX_GAIN,
  AUDIO_LOUDNESS_TARGET_LUFS,
  gainFromLoudness,
} from "~/domain/audio/loudness";

/** Platform anchor — voice should sit here. */
export const AROLL_TARGET_LUFS = -14.5;

/** SFX punctuate ~10 dB below voice (target band −22 to −26). */
export const SFX_TARGET_LUFS = -24;

/**
 * Short one-shots measure quiet on integrated LUFS but peak near 0 dBTP.
 * After mix, cap true peak so transients sit under voice.
 */
export const SFX_MAX_TRUE_PEAK_DB = -16;

/** Full music bed ~14 dB below voice (target band −24 to −32). */
export const MUSIC_TARGET_LUFS = -28;

/** Library assets are normalized to this before role offsets. */
export const LIBRARY_LUFS = AUDIO_LOUDNESS_TARGET_LUFS;

/** Linear gain to reach `targetLufs` from `fromLufs`. */
export function lufsToGain(targetLufs: number, fromLufs: number): number {
  return 10 ** ((targetLufs - fromLufs) / 20);
}

/** Default SFX slider level (−24 LUFS after library normalize). */
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

function capGainToTruePeak(
  gain: number,
  truePeakDb: number | null | undefined,
  maxTruePeakDb: number,
): number {
  if (gain <= 0 || truePeakDb == null || !Number.isFinite(truePeakDb)) {
    return gain;
  }
  const peakCap = 10 ** ((maxTruePeakDb - truePeakDb) / 20);
  if (!Number.isFinite(peakCap) || peakCap <= 0) return gain;
  return Math.min(gain, peakCap, AUDIO_LOUDNESS_MAX_GAIN);
}

/** Mix slider × library-normalize gain (music). */
export function mixPlaybackVolume(
  mixVolume: number,
  lufs: number | null | undefined,
  truePeakDb: number | null | undefined,
): number {
  return Math.max(0, mixVolume * libraryPlaybackGain(lufs, truePeakDb));
}

/** SFX mix, with a true-peak ceiling so one-shots don't overpower voice. */
export function sfxPlaybackVolume(
  mixVolume: number,
  lufs: number | null | undefined,
  truePeakDb: number | null | undefined,
): number {
  return capGainToTruePeak(
    mixPlaybackVolume(mixVolume, lufs, truePeakDb),
    truePeakDb,
    SFX_MAX_TRUE_PEAK_DB,
  );
}
