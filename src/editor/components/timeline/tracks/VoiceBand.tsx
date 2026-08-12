import { useMemo } from "react";

import { peakMax, sampleWaveformGrid } from "~/domain/audio/waveform";
import type { TimelineTime } from "~/domain/time";
import { useEditor } from "~/editor/store";

type Props = TimelineTime & {
  /** Local asset time for this keep cell. */
  localStart: number;
  localEnd: number;
  assetId: string;
};

const CENTER = 50;
const MAX_HALF = 46;
const MIN_HALF = 3;
const CENTER_GAP = 1.2;
const BAR_PX = 2.2;

export function VoiceBand({
  start,
  end,
  localStart,
  localEnd,
  assetId,
}: Props) {
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const waveform = useEditor(
    (s) => s.assets.find((a) => a.id === assetId)?.waveform ?? null,
  );

  const bars = useMemo(() => {
    if (pxPerSec <= 0 || end <= start) return [];
    if (!waveform || waveform.peaks.length === 0) return [];
    const maxAmp = peakMax(waveform.peaks);
    if (maxAmp <= 0) return [];
    return sampleWaveformGrid(
      waveform,
      localStart,
      localEnd,
      BAR_PX / pxPerSec,
      maxAmp,
    );
  }, [start, end, localStart, localEnd, pxPerSec, waveform]);

  if (bars.length < 2) return null;

  const topEnd = CENTER - CENTER_GAP / 2;
  const bottomStart = CENTER + CENTER_GAP / 2;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {bars.map((bar, i) => {
        const x = bar.x * 100;
        const half =
          bar.amp > 0.02
            ? Math.max(MIN_HALF, bar.amp * MAX_HALF)
            : MIN_HALF;

        return (
          <g key={i} stroke="#1a1508" strokeLinecap="round">
            <line
              x1={x}
              y1={topEnd - half}
              x2={x}
              y2={topEnd}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={x}
              y1={bottomStart}
              x2={x}
              y2={bottomStart + half}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}
