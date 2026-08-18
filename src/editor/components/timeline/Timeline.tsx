import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildArollLayoutFromAssets } from '~/domain/arolls';
import { layoutTimelineDuration } from '~/domain/layout-time';
import { LABEL_OFFSET, TIMELINE_MAX_HEIGHT } from '~/editor/components/timeline/constants';
import {
    contentXForSec, useTimelineZoom
} from '~/editor/components/timeline/hooks/useTimelineZoom';
import { Playhead } from '~/editor/components/timeline/Playhead';
import { TimelineRuler } from '~/editor/components/timeline/TimelineRuler';
import { TransitionGutter } from '~/editor/components/timeline/TransitionGutter';
import { BRollTrack } from '~/editor/components/timeline/tracks/BRollTrack';
import { CaptionTrack } from '~/editor/components/timeline/tracks/CaptionTrack';
import { SfxTrack } from '~/editor/components/timeline/tracks/SfxTrack';
import { VfxTrack } from '~/editor/components/timeline/tracks/VfxTrack';
import { VideoTrack } from '~/editor/components/timeline/tracks/VideoTrack';
import { ZoomTrack } from '~/editor/components/timeline/tracks/ZoomTrack';
import { getPlayer } from '~/editor/lib/player-bridge';
import { editsTopologyEqual } from '~/editor/lib/edit-topology';
import { isTimelineScrubbing, setTimelineScrubbing, useEditor, useEditorEqual } from '~/editor/store';

import type {
  BrollEdit,
  SfxEdit,
  TransitionEdit,
  VfxEdit,
  ZoomEdit,
} from "~/domain/project-config";
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
  const arolls = useEditor((s) => s.config?.arolls);
  const edits = useEditorEqual((s) => s.config?.edits, editsTopologyEqual);
  const assets = useEditor((s) => s.assets);
  const seekTimeline = useEditor((s) => s.seekTimeline);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [hoverSec, setHoverSec] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const skipClickRef = useRef(false);

  const zooms =
    edits?.filter((e): e is ZoomEdit => e.kind === "zoom") ?? [];
  const vfx =
    edits?.filter((e): e is VfxEdit => e.kind === "vfx") ?? [];
  const brolls =
    edits?.filter((e): e is BrollEdit => e.kind === "broll") ?? [];
  const sfx =
    edits?.filter((e): e is SfxEdit => e.kind === "sfx") ?? [];
  const transitions =
    edits?.filter((e): e is TransitionEdit => e.kind === "transition") ?? [];

  const layout = useMemo(() => {
    if (!arolls) return [];
    return buildArollLayoutFromAssets(arolls, assets);
  }, [arolls, assets]);

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
    <div
      className="border-border bg-panel hidden w-full min-w-0 shrink-0 flex-col overflow-hidden border-t lg:flex"
      style={{ maxHeight: TIMELINE_MAX_HEIGHT }}
    >
      <div
        ref={scrollRef}
        className="relative min-h-0 min-w-0 overflow-x-auto overflow-y-auto [touch-action:pan-x_pan-y]"
      >
        <div
          ref={contentRef}
          className="relative"
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
            <TransitionGutter
              layout={layout}
              edits={transitions}
              width={trackWidth}
            />
            <VideoTrack layout={layout} width={trackWidth} />
            <CaptionTrack width={trackWidth} />
            <BRollTrack edits={brolls} width={trackWidth} />
            <SfxTrack edits={sfx} width={trackWidth} />
            <ZoomTrack edits={zooms} width={trackWidth} />
            <VfxTrack edits={vfx} width={trackWidth} />
          </div>
        </div>
      </div>
    </div>
  );
}
