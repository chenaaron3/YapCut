import { memo, useCallback, useRef } from "react";

import { TrackLabel } from "~/editor/components/timeline/shared";
import { rangeStyle } from "~/editor/lib/timeline-time";
import { useEntitySelected } from "~/editor/lib/use-is-selected";
import { useWordDragSelect } from "~/editor/lib/use-word-drag-select";
import { useSelection } from "~/editor/selection-store";
import { useEditor, useGlobalWords } from "~/editor/store";
import { cn } from "~/lib/utils";

import type { GlobalTranscriptWord } from "~/domain/transcript";

type Props = {
  width: number;
};

const CaptionWord = memo(function CaptionWord({
  word,
  pxPerSec,
  onWordDragStart,
}: {
  word: GlobalTranscriptWord;
  pxPerSec: number;
  onWordDragStart: (globalIndex: number, e: React.MouseEvent) => void;
}) {
  const selected = useEntitySelected("word", word.globalIndex, word.assetId);
  const select = useSelection((s) => s.select);
  const seekTimeline = useEditor((s) => s.seekTimeline);
  const { left, width: w } = rangeStyle(word.start, word.end, pxPerSec);

  return (
    <div
      data-cell
      data-word-index={word.globalIndex}
      className={cn(
        "absolute top-1 bottom-1 z-[1] flex cursor-pointer items-center overflow-hidden rounded px-0.5 text-[10px] select-none",
        word.inGap ? "text-[#e8eaef]/55" : "text-[#e8eaef]",
        selected
          ? "bg-accent/50 z-[2] outline outline-2 outline-white"
          : word.inGap
            ? "bg-accent/10"
            : word.emphasized
              ? "bg-amber-500/40"
              : "bg-accent/25",
      )}
      style={{ left, width: w }}
      title={`${word.text}  ${word.start.toFixed(2)}–${word.end.toFixed(2)}s${word.inGap ? " (deleted)" : ""}`}
      onMouseDown={(e) => onWordDragStart(word.globalIndex, e)}
      onClick={(e) => {
        e.stopPropagation();
        select("word", word.globalIndex, e.metaKey || e.ctrlKey);
        seekTimeline(word.start);
      }}
    >
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {word.text}
      </span>
    </div>
  );
});

export function CaptionTrack({ width }: Props) {
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const words = useGlobalWords();
  const captionTrackRef = useRef<HTMLDivElement>(null);

  const resolveCaptionIndexAtPoint = useCallback(
    (clientX: number, _clientY: number) => {
      const track = captionTrackRef.current;
      if (!track || words.length === 0) return null;
      const x = clientX - track.getBoundingClientRect().left;

      for (const word of words) {
        const left = word.start * pxPerSec;
        const right = word.end * pxPerSec;
        if (x >= left && x <= right) return word.globalIndex;
      }

      for (let i = 0; i < words.length - 1; i++) {
        const curr = words[i]!;
        const next = words[i + 1]!;
        const gapStart = curr.end * pxPerSec;
        const gapEnd = next.start * pxPerSec;
        if (x > gapStart && x < gapEnd) {
          const mid = (gapStart + gapEnd) / 2;
          return x < mid ? curr.globalIndex : next.globalIndex;
        }
      }

      const first = words[0]!;
      const last = words[words.length - 1]!;
      if (x < first.start * pxPerSec) {
        return first.globalIndex;
      }
      if (x > last.end * pxPerSec) {
        return last.globalIndex;
      }
      return null;
    },
    [words, pxPerSec],
  );

  const { onDragStart: onWordDragStart } = useWordDragSelect(
    resolveCaptionIndexAtPoint,
  );

  return (
    <TrackLabel label="Captions" width={width}>
      <div
        ref={captionTrackRef}
        className="relative z-10 h-full w-full"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {words.map((word) => (
          <CaptionWord
            key={word.globalIndex}
            word={word}
            pxPerSec={pxPerSec}
            onWordDragStart={onWordDragStart}
          />
        ))}
      </div>
    </TrackLabel>
  );
}
