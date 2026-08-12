export const DEFAULT_PEAKS_PER_SEC = 200;

export type WaveformData = {
  peaks: Float32Array;
  peaksPerSec: number;
};

export type SerializedWaveform = {
  peaksPerSec: number;
  peaks: number[];
};

export function serializeWaveform(data: WaveformData): SerializedWaveform {
  return {
    peaksPerSec: data.peaksPerSec,
    peaks: Array.from(data.peaks),
  };
}

export function deserializeWaveform(raw: SerializedWaveform): WaveformData {
  return {
    peaksPerSec: raw.peaksPerSec,
    peaks: new Float32Array(raw.peaks),
  };
}

export type WaveformBar = {
  /** Position within the range as a fraction 0–1 (bar center). */
  x: number;
  /** Normalized amplitude 0–1. */
  amp: number;
};

/**
 * Sample peak bars on an absolute time grid.
 * Bar times are locked to `secondsPerBar` buckets so resizing a visible
 * range only reveals/hides edge bars — interior shape stays stable.
 * Density should change only when zoom (`secondsPerBar`) changes.
 */
export function sampleWaveformGrid(
  waveform: { peaks: ArrayLike<number>; peaksPerSec: number },
  startSec: number,
  endSec: number,
  secondsPerBar: number,
  globalMax?: number,
): WaveformBar[] {
  const { peaks, peaksPerSec } = waveform;
  if (secondsPerBar <= 0 || endSec <= startSec) return [];

  const maxAmp = globalMax ?? peakMax(peaks);
  const duration = endSec - startSec;
  const out: WaveformBar[] = [];

  const first = Math.floor(startSec / secondsPerBar);
  const last = Math.ceil(endSec / secondsPerBar) - 1;

  for (let i = first; i <= last; i++) {
    const t0 = i * secondsPerBar;
    const t1 = t0 + secondsPerBar;
    const tCenter = t0 + secondsPerBar / 2;
    if (tCenter < startSec || tCenter > endSec) continue;

    const i0 = Math.max(0, Math.floor(t0 * peaksPerSec));
    const i1 = Math.min(peaks.length, Math.ceil(t1 * peaksPerSec));
    let peak = 0;
    for (let j = i0; j < i1; j++) {
      if (peaks[j]! > peak) peak = peaks[j]!;
    }

    out.push({
      x: (tCenter - startSec) / duration,
      amp: maxAmp > 0 ? peak / maxAmp : 0,
    });
  }

  return out;
}

export function peakMax(peaks: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i]! > max) max = peaks[i]!;
  }
  return max;
}

/** Build peak amplitudes from mono PCM samples (normalized 0–1). */
export function computePeaksFromSamples(
  samples: Int16Array | Float32Array,
  sampleRate: number,
  peaksPerSec = DEFAULT_PEAKS_PER_SEC,
): Float32Array {
  const samplesPerPeak = Math.max(1, Math.floor(sampleRate / peaksPerSec));
  const peakCount = Math.ceil(samples.length / samplesPerPeak);
  const peaks = new Float32Array(peakCount);
  const isInt16 = samples instanceof Int16Array;

  for (let i = 0; i < peakCount; i++) {
    const from = i * samplesPerPeak;
    const to = Math.min(from + samplesPerPeak, samples.length);
    let max = 0;
    for (let j = from; j < to; j++) {
      const sample = isInt16
        ? Math.abs(samples[j]!) / 32768
        : Math.abs(samples[j]!);
      if (sample > max) max = sample;
    }
    peaks[i] = max;
  }

  return peaks;
}
