import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  buildArollLayout,
  layoutTimelineDuration,
} from "~/domain/arolls";
import type { VfxTextEdit, ZoomEdit } from "~/domain/project-config";
import { LABEL_OFFSET } from "~/editor/components/timeline/constants";
import {
  contentXForSec,
  useTimelineZoom,
} from "~/editor/components/timeline/hooks/useTimelineZoom";
import { Playhead } from "~/editor/components/timeline/Playhead";
import { TimelineRuler } from "~/editor/components/timeline/TimelineRuler";
import { CaptionTrack } from "~/editor/components/timeline/tracks/CaptionTrack";
import { VideoTrack } from "~/editor/components/timeline/tracks/VideoTrack";
import { VfxTrack } from "~/editor/components/timeline/tracks/VfxTrack";
import { ZoomTrack } from "~/editor/components/timeline/tracks/ZoomTrack";
import { getPlayer } from "~/editor/lib/player-bridge";
import {
  isTimelineScrubbing,
  setTimelineScrubbing,
  useEditor,
} from "~/editor/store";

function scrollPlayheadIntoView(el: HTMLDivElement, playheadX: number): void {
  const viewLeft = el.scrollLeft;
  const viewRight = viewLeft + el.clientWidth;
  if (playheadX >= viewLeft && playheadX <= viewRight) return;

  if (playheadX < viewLeft) {
    el.scrollLeft = playheadX;
  } else {
    el.scrollLeft = playheadX - el.clientWidth;
  }
}

export function Timeline() {
  const config = useEditor((s) => s.config);
  const assets = useEditor((s) => s.assets);
  const seekTimeline = useEditor((s) => s.seekTimeline);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [hoverSec, setHoverSec] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const skipClickRef = useRef(false);

  const zooms =
    config?.edits.filter((e): e is ZoomEdit => e.kind === "zoom") ?? [];
  const texts =
    config?.edits.filter(
      (e): e is VfxTextEdit => e.kind === "vfx" && e.type === "text",
    ) ?? [];

  const layout = useMemo(() => {
    if (!config) return [];
    const durations = new Map(assets.map((a) => [a.id, a.durationSec ?? 0]));
    return buildArollLayout(config.arolls, durations);
  }, [config, assets]);

  const timelineDuration = useMemo(
    () => layoutTimelineDuration(layout),
    [layout],
  );

  const pxPerSec = useTimelineZoom(scrollRef, contentRef, timelineDuration);

  const trackWidth = Math.max(400, timelineDuration * pxPerSec + 40);
  const totalWidth = LABEL_OFFSET + trackWidth;

  const clientXToTimelineSec = useCallback(
    (clientX: number): number | null => {
      const content = contentRef.current;
      if (!content) return null;
      const rect = content.getBoundingClientRect();
      const x = clientX - rect.left - LABEL_OFFSET;
      const sec = x / pxPerSec;
      if (sec < 0 || sec > timelineDuration) return null;
      return sec;
    },
    [timelineDuration, pxPerSec],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const sec = clientXToTimelineSec(clientX);
      if (sec == null) return;
      seekTimeline(sec);
    },
    [clientXToTimelineSec, seekTimeline],
  );

  const startScrub = useCallback(
    (clientX: number) => {
      skipClickRef.current = true;
      setScrubbing(true);
      setTimelineScrubbing(true);
      setHoverSec(null);
      seekFromClientX(clientX);

      const onMove = (ev: MouseEvent) => {
        seekFromClientX(ev.clientX);
      };

      const onUp = () => {
        setScrubbing(false);
        setTimelineScrubbing(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [seekFromClientX],
  );

  useEffect(() => {
    return useEditor.subscribe((state, prev) => {
      if (state.timelineSec === prev.timelineSec) return;
      if (isTimelineScrubbing()) return;
      if (getPlayer()?.isPlaying()) return;

      const el = scrollRef.current;
      if (!el) return;
      scrollPlayheadIntoView(
        el,
        contentXForSec(state.timelineSec, state.pxPerSec),
      );
    });
  }, []);

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden border-t border-border bg-panel">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Timeline
        </span>
        <span className="text-[11px] text-muted-foreground">
          ⌘/Ctrl + scroll to zoom · {pxPerSec.toFixed(0)} px/s
        </span>
      </div>

      <div
        ref={scrollRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto [touch-action:pan-x_pan-y]"
      >
        <div
          ref={contentRef}
          className="relative min-h-full"
          style={{ width: totalWidth }}
          onMouseMove={(e) => {
            if (scrubbing) return;
            setHoverSec(clientXToTimelineSec(e.clientX));
          }}
          onMouseLeave={() => {
            if (!scrubbing) setHoverSec(null);
          }}
          onClickCapture={(e) => {
            if (skipClickRef.current) {
              skipClickRef.current = false;
              return;
            }
            if ((e.target as HTMLElement).closest("[data-cell]")) return;
            seekFromClientX(e.clientX);
          }}
        >
          <Playhead
            hoverSec={hoverSec}
            pxPerSec={pxPerSec}
            scrubbing={scrubbing}
            onScrubStart={startScrub}
          />

          <TimelineRuler
            duration={timelineDuration}
            pxPerSec={pxPerSec}
            trackWidth={trackWidth}
            onScrubStart={startScrub}
          />

          <div className="py-2 pl-[72px]">
            <VideoTrack layout={layout} width={trackWidth} />
            <CaptionTrack width={trackWidth} />
            <ZoomTrack edits={zooms} width={trackWidth} />
            <VfxTrack edits={texts} width={trackWidth} />
          </div>
        </div>
      </div>
    </div>
  );
}
