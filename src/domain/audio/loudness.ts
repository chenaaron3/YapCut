/** Normalize library assets (SFX / music) toward this integrated loudness. */
export const AUDIO_LOUDNESS_TARGET_LUFS = -16;

/** Cap post-gain true peak to avoid clipping when boosting quiet files. */
export const AUDIO_LOUDNESS_MAX_TRUE_PEAK_DB = -1;

/** Hard ceiling on boost even when peak headroom allows more. */
export const AUDIO_LOUDNESS_MAX_GAIN = 10;

export type LoudnessProbe = {
  lufs: number;
  truePeakDb: number;
};

/** Gain from measured loudness, limited by true-peak headroom. Missing → 1. */
export function gainFromLoudness(
  lufs: number | null | undefined,
  truePeakDb: number | null | undefined,
  targetLufs = AUDIO_LOUDNESS_TARGET_LUFS,
): number {
  if (lufs == null || !Number.isFinite(lufs)) return 1;
  const lufsGain = 10 ** ((targetLufs - lufs) / 20);
  const peakCap =
    truePeakDb != null && Number.isFinite(truePeakDb)
      ? 10 ** ((AUDIO_LOUDNESS_MAX_TRUE_PEAK_DB - truePeakDb) / 20)
      : AUDIO_LOUDNESS_MAX_GAIN;
  const gain = Math.min(lufsGain, peakCap, AUDIO_LOUDNESS_MAX_GAIN);
  if (!Number.isFinite(gain) || gain <= 0) return 1;
  return gain;
}
