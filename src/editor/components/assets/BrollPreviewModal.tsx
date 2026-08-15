import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { BrollFilmstripTrack } from "~/editor/components/assets/BrollFilmstripTrack";
import { MIN_RANGE_SEC } from "~/editor/lib/range";
import { useTranscriptUi } from "~/editor/transcript-ui-store";

import type { EditorAsset } from "~/editor/store";

function formatPreviewTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function BrollPreviewModal({
  asset,
  open,
  onClose,
}: {
  asset: EditorAsset | null;
  open: boolean;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [range, setRange] = useState({ start: 0, end: 0 });

  const label = asset?.originalFilename ?? asset?.id.slice(0, 8) ?? "B-roll";
  const assetId = asset?.id ?? null;
  const assetDuration = asset?.durationSec ?? null;

  useEffect(() => {
    if (!open) return;
    const dur = assetDuration != null && assetDuration > 0 ? assetDuration : 0;
    setDuration(dur);
    setRange({ start: 0, end: dur });
    setCurrentTime(0);
    setPlaying(false);
  }, [open, assetId, assetDuration]);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      const next = Math.min(Math.max(0, time), duration || Infinity);
      setCurrentTime(next);
      if (video && Number.isFinite(next)) video.currentTime = next;
    },
    [duration],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (
        duration > 0 &&
        (video.currentTime < range.start ||
          video.currentTime >= range.end - 0.01)
      ) {
        video.currentTime = range.start;
        setCurrentTime(range.start);
      }
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [duration, range.end, range.start]);

  useEffect(() => {
    if (!open) {
      useTranscriptUi.getState().setToggleBrollPreviewPlayback(null);
      return;
    }
    useTranscriptUi.getState().setToggleBrollPreviewPlayback(togglePlay);
    return () => {
      useTranscriptUi.getState().setToggleBrollPreviewPlayback(null);
    };
  }, [open, togglePlay]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) setCurrentTime(video.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const canPlace = duration > 0 && range.end - range.start >= MIN_RANGE_SEC;

  const placeOnWord = () => {
    if (!asset || !canPlace) return;
    useTranscriptUi.getState().armBrollPlace({
      assetId: asset.id,
      mediaOffsetSec: range.start,
      durationSec: range.end - range.start,
      label,
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="bg-panel gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="truncate pr-8">{label}</DialogTitle>
          <DialogDescription>
            Preview and trim this B-roll clip, then place it on a word.
          </DialogDescription>
        </DialogHeader>

        {asset ? (
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div
              role="button"
              tabIndex={0}
              className="relative flex max-h-[55vh] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-black"
              onClick={togglePlay}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  togglePlay();
                }
              }}
            >
              <video
                ref={videoRef}
                src={asset.playbackUrl}
                playsInline
                preload="auto"
                className="max-h-[55vh] max-w-full object-contain"
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (!Number.isFinite(d) || d <= 0) return;
                  setDuration(d);
                  setRange((r) =>
                    r.end <= 0 || r.end > d + 0.05 ? { start: 0, end: d } : r,
                  );
                }}
                onTimeUpdate={(e) => {
                  const t = e.currentTarget.currentTime;
                  setCurrentTime(t);
                  if (!e.currentTarget.paused && t >= range.end - 0.02) {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = range.end;
                    setCurrentTime(range.end);
                  }
                }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              />
              {!playing ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                  <Play
                    className="size-10 text-white drop-shadow"
                    fill="currentColor"
                  />
                </span>
              ) : null}
            </div>

            <BrollFilmstripTrack
              src={asset.playbackUrl}
              videoWidth={asset.width ?? 16}
              videoHeight={asset.height ?? 9}
              duration={duration}
              currentTime={currentTime}
              range={range}
              label={label}
              onSeek={seekTo}
              onRangeChange={setRange}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <button
                  type="button"
                  className="text-foreground hover:bg-panel-2 inline-flex size-7 items-center justify-center rounded-md"
                  onClick={togglePlay}
                  title={playing ? "Pause" : "Play"}
                >
                  {playing ? (
                    <Pause className="size-3.5" fill="currentColor" />
                  ) : (
                    <Play className="size-3.5" fill="currentColor" />
                  )}
                </button>
                <span>
                  {formatPreviewTime(currentTime)} /{" "}
                  {formatPreviewTime(duration)}
                </span>
                <span>
                  {formatPreviewTime(range.start)} –{" "}
                  {formatPreviewTime(range.end)} (
                  {(range.end - range.start).toFixed(1)}s)
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!canPlace}
                onClick={placeOnWord}
              >
                Place on word
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
