import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";

import type { PlayerRef } from "@remotion/player";

import { TransformOverlay } from "~/editor/components/player/TransformOverlay";
import {
  ensurePlayerAudible,
  getPlayer,
  peekPlayAfterSeek,
  setPlayer,
  takePlayAfterSeek,
} from "~/editor/lib/player-bridge";
import { isTimelineScrubbing, useEditor } from "~/editor/store";
import { TalkingHead, type TalkingHeadProps } from "~/remotion/TalkingHead";
import {
  COMPOSITION_FPS,
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/constants";

function FrameCounter({ durationInFrames }: { durationInFrames: number }) {
  const frame = useEditor((s) => s.frame);
  return (
    <div className="shrink-0 border-t border-border px-2 py-1 text-center text-xs text-muted-foreground">
      f{frame} / {durationInFrames}
    </div>
  );
}

export function PlayerPanel() {
  const props = useEditor((s) => s.props);
  const seekFrame = useEditor((s) => s.seekFrame);
  const syncActiveWord = useEditor((s) => s.syncActiveWord);
  const ref = useRef<PlayerRef | null>(null);
  const seekTargetRef = useRef<number | null>(null);
  const [overlayDragging, setOverlayDragging] = useState(false);

  const inputProps: TalkingHeadProps | null = useMemo(() => props, [props]);

  const setPlayerRef = useCallback((instance: PlayerRef | null) => {
    ref.current = instance;
    setPlayer(instance);
  }, []);

  /** Clear Remotion sticky-mute before clickToPlay runs in the same gesture. */
  const onPlayGesture = useCallback(() => {
    ensurePlayerAudible(ref.current);
  }, []);

  useLayoutEffect(() => {
    const player = ref.current;
    if (!player) return;

    const onUpdate = () => {
      if (isTimelineScrubbing()) return;
      const current = player.getCurrentFrame();
      const target = seekTargetRef.current;
      if (target != null) {
        if (Math.abs(current - target) <= 1) {
          seekTargetRef.current = null;
          if (takePlayAfterSeek()) player.play();
        }
        return;
      }
      seekFrame(current);
      if (player.isPlaying()) {
        syncActiveWord();
      }
    };

    player.addEventListener("frameupdate", onUpdate);
    return () => {
      player.removeEventListener("frameupdate", onUpdate);
    };
  }, [seekFrame, syncActiveWord, inputProps]);

  useLayoutEffect(() => {
    return useEditor.subscribe((state, prev) => {
      if (state.frame === prev.frame) return;
      const player = ref.current ?? getPlayer();
      if (!player) return;
      const frame = state.frame;
      if (isTimelineScrubbing()) {
        seekTargetRef.current = frame;
        player.seekTo(frame);
        return;
      }
      const current = player.getCurrentFrame();
      if (Math.abs(current - frame) <= 1) {
        seekTargetRef.current = null;
        return;
      }
      const lag = current - frame;
      if (player.isPlaying() && lag > 0 && lag <= 8) return;
      seekTargetRef.current = frame;
      if (player.isPlaying() && !peekPlayAfterSeek()) {
        player.pause();
      }
      player.seekTo(frame);
    });
  }, []);

  if (!inputProps) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0b0c10] text-sm text-muted-foreground">
        No preview
      </div>
    );
  }

  const durationInFrames = Math.max(1, inputProps.durationInFrames);

  return (
    <div className="relative z-20 flex h-full min-h-0 flex-col bg-[#0b0c10]">
      <div className="relative z-20 flex min-h-0 flex-1 items-center justify-center overflow-visible bg-black">
        <div
          className="relative h-full max-h-full w-auto max-w-full overflow-visible"
          style={{
            aspectRatio: `${COMPOSITION_WIDTH} / ${COMPOSITION_HEIGHT}`,
          }}
          onPointerDownCapture={onPlayGesture}
        >
          <Player
            ref={setPlayerRef}
            component={TalkingHead}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            compositionWidth={COMPOSITION_WIDTH}
            compositionHeight={COMPOSITION_HEIGHT}
            fps={COMPOSITION_FPS}
            style={{ width: "100%", height: "100%" }}
            controls={false}
            clickToPlay={!overlayDragging}
            spaceKeyToPlayOrPause={false}
          />
          <TransformOverlay onDraggingChange={setOverlayDragging} />
        </div>
      </div>
      <FrameCounter durationInFrames={durationInFrames} />
    </div>
  );
}
