import { useMemo } from "react";

import type { TimelineTime } from "~/domain/time";
import type { GlobalTranscriptWord } from "~/domain/transcript";
import { useEditor } from "~/editor/store";

type Props = TimelineTime & {
  words: GlobalTranscriptWord[];
};

const CENTER = 50;
const MAX_HALF = 46;
const MIN_HALF = 3;
const CENTER_GAP = 1.2;
const BAR_PX = 2.2;

type Bar = { x: number; amp: number };

/** Envelope from word timing (no audio peaks yet). */
function buildWordEnvelopeGrid(
  start: number,
  end: number,
  words: GlobalTranscriptWord[],
  secondsPerBar: number,
): Bar[] {
  const duration = end - start;
  if (duration <= 0 || secondsPerBar <= 0) return [];

  const active = words.filter((w) => w.start < end && w.end > start);
  const out: Bar[] = [];
  const first = Math.floor(start / secondsPerBar);
  const last = Math.ceil(end / secondsPerBar) - 1;

  for (let i = first; i <= last; i++) {
    const t0 = i * secondsPerBar;
    const tCenter = t0 + secondsPerBar / 2;
    if (tCenter < start || tCenter > end) continue;
    const speaking = active.some((w) => tCenter >= w.start && tCenter < w.end);
    out.push({
      x: (tCenter - start) / duration,
      amp: speaking ? 0.7 : 0.04,
    });
  }

  return out;
}

export function VoiceBand({ start, end, words }: Props) {
  const pxPerSec = useEditor((s) => s.pxPerSec);

  const bars = useMemo(() => {
    if (pxPerSec <= 0 || end <= start) return [];
    return buildWordEnvelopeGrid(start, end, words, BAR_PX / pxPerSec);
  }, [start, end, words, pxPerSec]);

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
