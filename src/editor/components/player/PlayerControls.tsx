import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

import { Button } from "~/components/ui/button";
import { getPlayer, togglePlayback } from "~/editor/lib/player-bridge";
import { useEditor } from "~/editor/store";
import { COMPOSITION_FPS } from "~/remotion/helpers/constants";

function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  const whole = Math.floor(rem);
  const tenths = Math.floor((rem - whole) * 10);
  return `${m}:${String(whole).padStart(2, "0")}.${tenths}`;
}

export function PlayerControls({
  durationInFrames,
}: {
  durationInFrames: number;
}) {
  const frame = useEditor((s) => s.frame);
  const [playing, setPlaying] = useState(false);

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

  const currentSec = frame / COMPOSITION_FPS;
  const durationSec = durationInFrames / COMPOSITION_FPS;

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border px-2 py-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={playing ? "Pause" : "Play"}
        title={playing ? "Pause" : "Play"}
        onClick={() => togglePlayback()}
      >
        {playing ? (
          <Pause className="size-3.5" fill="currentColor" />
        ) : (
          <Play className="size-3.5" fill="currentColor" />
        )}
      </Button>
      <div className="min-w-0 flex-1 font-mono text-xs tabular-nums text-muted-foreground">
        {formatTime(currentSec)}
        <span className="text-muted-foreground/60"> / </span>
        {formatTime(durationSec)}
      </div>
    </div>
  );
}
