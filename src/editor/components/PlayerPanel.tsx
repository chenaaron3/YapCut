import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { Player } from "@remotion/player";

import type { PlayerRef } from "@remotion/player";
import type { FC } from "react";

import {
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
  const config = useEditor((s) => s.config);
  const seekFrame = useEditor((s) => s.seekFrame);
  const ref = useRef<PlayerRef | null>(null);
  const seekTargetRef = useRef<number | null>(null);

  const inputProps: TalkingHeadProps | null = useMemo(() => {
    if (!props || !config) return null;
    return {
      ...props,
      captionTemplateId: config.captions.templateId,
      captionOverrides: config.captions.overrides,
    };
  }, [props, config]);

  const setPlayerRef = useCallback((instance: PlayerRef | null) => {
    ref.current = instance;
    setPlayer(instance);
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
    };

    player.addEventListener("frameupdate", onUpdate);
    return () => {
      player.removeEventListener("frameupdate", onUpdate);
    };
  }, [seekFrame, inputProps]);

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
    <div className="flex h-full min-h-0 flex-col bg-[#0b0c10]">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        <div
          className="relative h-full max-h-full w-auto max-w-full"
          style={{
            aspectRatio: `${COMPOSITION_WIDTH} / ${COMPOSITION_HEIGHT}`,
          }}
        >
          <Player
            ref={setPlayerRef}
            component={TalkingHead as unknown as FC<Record<string, unknown>>}
            inputProps={inputProps as unknown as Record<string, unknown>}
            durationInFrames={durationInFrames}
            compositionWidth={COMPOSITION_WIDTH}
            compositionHeight={COMPOSITION_HEIGHT}
            fps={COMPOSITION_FPS}
            style={{ width: "100%", height: "100%" }}
            controls={false}
            clickToPlay
            spaceKeyToPlayOrPause={false}
          />
        </div>
      </div>
      <FrameCounter durationInFrames={durationInFrames} />
    </div>
  );
}
