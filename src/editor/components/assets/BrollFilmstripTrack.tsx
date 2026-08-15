import { useEffect, useMemo, useRef, useState } from "react";

import { clampBoundedRange, moveBoundedRange } from "~/editor/lib/range";
import { cn } from "~/lib/utils";

const TRACK_H = 64;
const HANDLE_PX = 10;

type DragMode = "seek" | "start" | "end" | "middle";

type DragState = {
  mode: DragMode;
  originTime: number;
  rangeStart: number;
  rangeEnd: number;
};

function timeAtX(clientX: number, el: HTMLElement, duration: number): number {
  const rect = el.getBoundingClientRect();
  const t = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  return Math.min(Math.max(0, t * duration), duration);
}

function hitTest(
  clientX: number,
  el: HTMLElement,
  duration: number,
  range: { start: number; end: number },
): DragMode {
  const rect = el.getBoundingClientRect();
  const x = clientX - rect.left;
  const startX = duration > 0 ? (range.start / duration) * rect.width : 0;
  const endX = duration > 0 ? (range.end / duration) * rect.width : 0;
  const distStart = Math.abs(x - startX);
  const distEnd = Math.abs(x - endX);
  if (distStart <= HANDLE_PX && distStart <= distEnd) return "start";
  if (distEnd <= HANDLE_PX) return "end";
  if (x > startX && x < endX) return "middle";
  return "seek";
}

export function BrollFilmstripTrack({
  src,
  videoWidth,
  videoHeight,
  duration,
  currentTime,
  range,
  label,
  onSeek,
  onRangeChange,
}: {
  src: string;
  videoWidth: number;
  videoHeight: number;
  duration: number;
  currentTime: number;
  range: { start: number; end: number };
  label: string;
  onSeek: (time: number) => void;
  onRangeChange: (range: { start: number; end: number }) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setTrackWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    setTrackWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const startPct = duration > 0 ? (range.start / duration) * 100 : 0;
  const endPct = duration > 0 ? (range.end / duration) * 100 : 100;
  const playPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const applyDrag = (clientX: number, el: HTMLElement) => {
    const drag = dragRef.current;
    if (!drag || duration <= 0) return;
    const time = timeAtX(clientX, el, duration);
    if (drag.mode === "seek") {
      onSeek(time);
      return;
    }
    if (drag.mode === "start") {
      const next = clampBoundedRange(time, drag.rangeEnd, duration);
      onRangeChange(next);
      onSeek(next.start);
      return;
    }
    if (drag.mode === "end") {
      const next = clampBoundedRange(drag.rangeStart, time, duration);
      onRangeChange(next);
      onSeek(next.end);
      return;
    }
    const next = moveBoundedRange(
      drag.rangeStart,
      drag.rangeEnd,
      time - drag.originTime,
      duration,
    );
    onRangeChange(next);
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="B-roll source range"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      tabIndex={0}
      className="relative h-16 w-full touch-none overflow-hidden rounded-md bg-[#14363a] select-none"
      onPointerDown={(e) => {
        if (e.button !== 0 || duration <= 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const mode = hitTest(e.clientX, e.currentTarget, duration, range);
        dragRef.current = {
          mode,
          originTime: timeAtX(e.clientX, e.currentTarget, duration),
          rangeStart: range.start,
          rangeEnd: range.end,
        };
        applyDrag(e.clientX, e.currentTarget);
      }}
      onPointerMove={(e) => {
        if (dragRef.current) {
          applyDrag(e.clientX, e.currentTarget);
          return;
        }
        if (duration <= 0) return;
        const mode = hitTest(e.clientX, e.currentTarget, duration, range);
        e.currentTarget.style.cursor =
          mode === "start" || mode === "end"
            ? "ew-resize"
            : mode === "middle"
              ? "grab"
              : "pointer";
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onKeyDown={(e) => {
        if (duration <= 0) return;
        const step = e.shiftKey ? 0.1 : 1;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onSeek(Math.max(0, currentTime - step));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onSeek(Math.min(duration, currentTime + step));
        }
      }}
    >
      <FilmstripFrames
        src={src}
        duration={duration}
        trackWidth={trackWidth}
        videoWidth={videoWidth}
        videoHeight={videoHeight}
      />

      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-black/55"
        style={{ width: `${startPct}%` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 bg-black/55"
        style={{ width: `${100 - endPct}%` }}
      />

      <div
        className="absolute inset-y-0 border border-white/80 bg-white/15"
        style={{
          left: `${startPct}%`,
          width: `${Math.max(0, endPct - startPct)}%`,
        }}
      >
        <span
          className={cn(
            "absolute top-0 bottom-0 left-0 z-10 w-1.5 cursor-ew-resize bg-white",
            "shadow-[0_0_0_1px_rgba(0,0,0,0.35)]",
          )}
        />
        <span
          className={cn(
            "absolute top-0 right-0 bottom-0 z-10 w-1.5 cursor-ew-resize bg-white",
            "shadow-[0_0_0_1px_rgba(0,0,0,0.35)]",
          )}
        />
        <span className="pointer-events-none absolute top-1 left-2 truncate text-[10px] font-medium text-white/90 drop-shadow">
          {label}
        </span>
      </div>

      <div
        className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500"
        style={{ left: `${playPct}%` }}
      >
        <span className="absolute -top-0.5 left-1/2 size-1.5 -translate-x-1/2 rotate-45 bg-red-500" />
      </div>
    </div>
  );
}

function FilmstripFrames({
  src,
  duration,
  trackWidth,
  videoWidth,
  videoHeight,
}: {
  src: string;
  duration: number;
  trackWidth: number;
  videoWidth: number;
  videoHeight: number;
}) {
  const aspect =
    videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : 9 / 16;
  const frameWidth = Math.max(8, Math.round(TRACK_H * aspect));
  const times = useMemo(() => {
    if (trackWidth <= 0 || duration <= 0) return [];
    const count = Math.max(1, Math.ceil(trackWidth / frameWidth));
    return Array.from(
      { length: count },
      (_, i) => ((i + 0.5) / count) * duration,
    );
  }, [trackWidth, duration, frameWidth]);

  if (times.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex overflow-hidden">
      {times.map((time) => (
        <FilmstripFrame
          key={`${src}:${time.toFixed(3)}`}
          src={src}
          time={time}
          width={frameWidth}
        />
      ))}
    </div>
  );
}

function FilmstripFrame({
  src,
  time,
  width,
}: {
  src: string;
  time: number;
  width: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const seek = () => {
      if (Math.abs(video.currentTime - time) > 0.01) {
        video.currentTime = time;
      }
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
    else video.addEventListener("loadedmetadata", seek, { once: true });
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [src, time]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="auto"
      className="h-full shrink-0 object-cover"
      style={{ width }}
    />
  );
}
