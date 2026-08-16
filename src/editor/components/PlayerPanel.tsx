import { Player } from "@remotion/player";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { CaptionOverlay } from "~/editor/components/player/CaptionOverlay";
import { PlayerControls } from "~/editor/components/player/PlayerControls";
import { TransformOverlay } from "~/editor/components/player/TransformOverlay";
import {
  ensurePlayerAudible,
  getPlayer,
  setPlayer,
} from "~/editor/lib/player-bridge";
import { isTimelineScrubbing, useEditor } from "~/editor/store";
import {
  COMPOSITION_FPS,
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";
import { TalkingHead } from "~/remotion/TalkingHead";

import type { PlayerRef } from "@remotion/player";
import type { TalkingHeadProps } from "~/remotion/TalkingHead";

export function PlayerPanel() {
  const props = useEditor((s) => s.props);
  const seekFrame = useEditor((s) => s.seekFrame);
  const syncActiveWord = useEditor((s) => s.syncActiveWord);
  const shellRef = useRef<HTMLDivElement>(null);
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

  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void shell.requestFullscreen();
  }, []);

  useLayoutEffect(() => {
    // Props/duration changes invalidate in-flight seeks.
    seekTargetRef.current = null;

    const player = ref.current;
    if (!player) return;

    const syncFromPlayer = () => {
      const current = player.getCurrentFrame();
      seekFrame(current);
      if (player.isPlaying()) syncActiveWord();
    };

    const onUpdate = () => {
      if (isTimelineScrubbing()) return;
      const current = player.getCurrentFrame();
      const target = seekTargetRef.current;
      if (target != null) {
        if (Math.abs(current - target) <= 1) {
          seekTargetRef.current = null;
          syncFromPlayer();
          return;
        }
        // Paused seek still in flight — wait. If playback resumed (or the
        // seek was abandoned), follow the player or store freezes forever.
        if (!player.isPlaying()) return;
        seekTargetRef.current = null;
      }
      syncFromPlayer();
    };

    const onPlay = () => {
      // Space/click-to-play must not stay blocked on a stale seek target.
      seekTargetRef.current = null;
      syncFromPlayer();
    };

    player.addEventListener("frameupdate", onUpdate);
    player.addEventListener("play", onPlay);
    return () => {
      player.removeEventListener("frameupdate", onUpdate);
      player.removeEventListener("play", onPlay);
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
      player.seekTo(frame);
    });
  }, []);

  if (!inputProps) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0b0c10] text-sm text-[#F5F9CE]/55">
        No preview
      </div>
    );
  }

  const durationInFrames = Math.max(1, inputProps.durationInFrames);

  return (
    <div
      ref={shellRef}
      className="relative z-20 flex h-full min-h-0 flex-col bg-[#0b0c10]"
    >
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
          <CaptionOverlay onDraggingChange={setOverlayDragging} />
        </div>
      </div>
      <PlayerControls
        durationInFrames={durationInFrames}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  );
}
