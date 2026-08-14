import { useEffect, useState } from "react";
import { Maximize, Minimize, Pause, Play } from "lucide-react";

import { Button } from "~/components/ui/button";
import { getPlayer, togglePlayback } from "~/editor/lib/player-bridge";
import { useEditor } from "~/editor/store";
import { COMPOSITION_FPS } from "~/remotion/helpers/constants";

/** Shorts timecode `m:ss:ff` (no hours — clips stay under ~10 min). */
function formatTimecode(frame: number, fps: number): string {
  const f = Math.max(0, Math.floor(frame));
  const ff = String(f % fps).padStart(2, "0");
  const totalSec = Math.floor(f / fps);
  const ss = String(totalSec % 60).padStart(2, "0");
  const m = Math.floor(totalSec / 60);
  return `${m}:${ss}:${ff}`;
}

export function PlayerControls({
  durationInFrames,
  onToggleFullscreen,
}: {
  durationInFrames: number;
  onToggleFullscreen: () => void;
}) {
  const frame = useEditor((s) => s.frame);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const player = getPlayer();
    if (!player) return;
    const sync = () => setPlaying(player.isPlaying());
    sync();
    player.addEventListener("play", sync);
    player.addEventListener("pause", sync);
    player.addEventListener("ended", sync);
    return () => {
      player.removeEventListener("play", sync);
      player.removeEventListener("pause", sync);
      player.removeEventListener("ended", sync);
    };
  }, [durationInFrames]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement != null);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  return (
    <div className="grid h-9 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-t border-border px-2">
      <div className="justify-self-start overflow-hidden font-mono text-[11px] leading-none tabular-nums tracking-tight whitespace-nowrap">
        <span className="text-teal-400">
          {formatTimecode(frame, COMPOSITION_FPS)}
        </span>
        <span className="text-muted-foreground/50"> / </span>
        <span className="text-muted-foreground">
          {formatTimecode(durationInFrames, COMPOSITION_FPS)}
        </span>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="justify-self-center text-foreground"
        aria-label={playing ? "Pause" : "Play"}
        title={playing ? "Pause (Space)" : "Play (Space)"}
        onClick={(e) => togglePlayback(e)}
      >
        {playing ? (
          <Pause className="size-4" fill="currentColor" />
        ) : (
          <Play className="size-4" fill="currentColor" />
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="justify-self-end text-muted-foreground hover:text-foreground"
        aria-label={fullscreen ? "Exit full screen" : "Full screen"}
        title={fullscreen ? "Exit full screen" : "Full screen"}
        onClick={onToggleFullscreen}
      >
        {fullscreen ? (
          <Minimize className="size-4" />
        ) : (
          <Maximize className="size-4" />
        )}
      </Button>
    </div>
  );
}
