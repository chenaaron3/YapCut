import { useEffect, useRef } from "react";

import { outputToTimelineSec } from "~/domain/arolls";
import { LABEL_OFFSET } from "~/editor/components/timeline/constants";
import { formatTimeHover } from "~/editor/lib/timeline-time";
import { getPlayer } from "~/editor/lib/player-bridge";
import { useEditor } from "~/editor/store";

type Props = {
  /** Hover position in timeline seconds. */
  hoverSec: number | null;
  pxPerSec: number;
  scrubbing: boolean;
  onScrubStart: (clientX: number) => void;
};

export function Playhead({
  hoverSec,
  pxPerSec,
  scrubbing,
  onScrubStart,
}: Props) {
  const activeRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(scrubbing);
  scrubbingRef.current = scrubbing;

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const el = activeRef.current;
      if (el) {
        const player = getPlayer();
        const { timelineSec, fps, pxPerSec: scale, getLayout } =
          useEditor.getState();
        let sec = timelineSec;

        if (player?.isPlaying() && !scrubbingRef.current) {
          const outputSec = player.getCurrentFrame() / fps;
          sec = outputToTimelineSec(getLayout(), outputSec);
        }

        const x = LABEL_OFFSET + sec * scale;
        el.style.transform = `translate3d(${x}px, 0, 0)`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const x =
      LABEL_OFFSET + useEditor.getState().timelineSec * pxPerSec;
    el.style.transform = `translate3d(${x}px, 0, 0)`;
  }, [pxPerSec]);

  const hoverX =
    hoverSec != null ? LABEL_OFFSET + hoverSec * pxPerSec : null;

  return (
    <>
      {!scrubbing && hoverX != null && hoverSec != null ? (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-50 w-px bg-white/30"
            style={{ left: hoverX }}
          />
          <div className="pointer-events-none sticky top-1 z-50 h-0">
            <div
              className="absolute -translate-x-1/2 rounded bg-panel-2/90 px-1 py-px text-[10px] leading-none text-[#e8eaef]"
              style={{ left: hoverX }}
            >
              {formatTimeHover(hoverSec)}
            </div>
          </div>
        </>
      ) : null}

      <div
        ref={activeRef}
        className="pointer-events-none absolute top-0 bottom-0 left-0 z-50 will-change-transform"
      >
        <div className="pointer-events-none relative h-full w-0.5 -translate-x-1/2 bg-sky-400">
          <div
            className="pointer-events-auto absolute top-0 left-1/2 h-3 w-2 -translate-x-1/2 cursor-ew-resize rounded-sm bg-sky-400"
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              onScrubStart(e.clientX);
            }}
          />
        </div>
      </div>
    </>
  );
}
