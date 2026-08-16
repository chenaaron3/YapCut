import { Film, Pause, Play, Volume2, VolumeX } from "lucide-react";

import { formatClock } from "~/components/projects/create-project/format";
import { useStitchedPreview } from "~/components/projects/create-project/use-stitched-preview";

import type { ClipItem } from "~/components/projects/create-project/types";

export function StitchedPreview({
  clips,
  activeId,
  onActiveChange,
}: {
  clips: ClipItem[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
}) {
  const {
    videoRef,
    activeClip,
    playing,
    setPlaying,
    muted,
    setMuted,
    setMeasuredSec,
    setCurrentSec,
    totalSec,
    timelineSec,
    playNext,
    togglePlayback,
    seekTimeline,
  } = useStitchedPreview(clips, activeId, onActiveChange);

  return (
    <div className="@container [container-type:size] flex min-h-0 flex-1 items-center justify-center">
      <div className="ember-card-shadow flex h-full w-[min(100%,calc(100cqh*9/16+1.25rem))] flex-col overflow-hidden rounded-[24px] border-2 border-[#450E16] bg-[#BC2D29] p-2.5 text-[#F5F9CE]">
        <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-2xl border-2 border-[#450E16] bg-[#24151a]">
          {activeClip ? (
            <video
              ref={videoRef}
              className="h-full w-full cursor-pointer object-cover"
              muted={muted}
              playsInline
              preload="auto"
              aria-label="Stitched preview"
              onClick={togglePlayback}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={playNext}
              onTimeUpdate={(event) =>
                setCurrentSec(event.currentTarget.currentTime)
              }
              onLoadedMetadata={(event) => {
                const next = event.currentTarget.duration;
                if (Number.isFinite(next)) setMeasuredSec(next);
              }}
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center px-4 text-center">
              <span className="flex flex-col items-center gap-2 text-[#F5F9CE]/70">
                <Film className="size-7" aria-hidden />
                <span className="text-sm leading-snug">
                  Add a clip to preview
                </span>
              </span>
            </span>
          )}
          <span className="ember-mono absolute top-2.5 left-2.5 rounded-full bg-[#FFA102] px-2.5 py-1.5 text-[9px] font-bold tracking-[0.1em] text-[#450E16] uppercase">
            Now previewing
          </span>
          {activeClip ? (
            <button
              type="button"
              className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full border-2 border-[#450E16] bg-[#FFA102] text-[#450E16]"
              aria-label={muted ? "Unmute preview" : "Mute preview"}
              title={muted ? "Unmute" : "Mute"}
              onClick={(event) => {
                event.stopPropagation();
                setMuted((current) => !current);
              }}
            >
              {muted ? (
                <VolumeX className="size-3.5" aria-hidden />
              ) : (
                <Volume2 className="size-3.5" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
        {activeClip ? (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-[#450E16] bg-[#FFA102] text-[#450E16]"
              aria-label={playing ? "Pause preview" : "Play preview"}
              onClick={togglePlayback}
            >
              {playing ? (
                <Pause className="size-3.5" aria-hidden />
              ) : (
                <Play className="size-3.5 translate-x-px" aria-hidden />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1000}
              value={
                totalSec > 0 ? Math.round((timelineSec / totalSec) * 1000) : 0
              }
              disabled={totalSec <= 0}
              aria-label="Preview position"
              className="h-1.5 flex-1 cursor-pointer accent-[#FFA102]"
              onChange={(event) =>
                seekTimeline((Number(event.target.value) / 1000) * totalSec)
              }
            />
            <span className="ember-mono shrink-0 text-[10px] text-[#F5F9CE]">
              {formatClock(timelineSec)} / {formatClock(totalSec || null)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
