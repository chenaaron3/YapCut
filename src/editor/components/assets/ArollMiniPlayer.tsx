"use client";

import { useEffect, useRef } from "react";
import { Layers2, Play } from "lucide-react";

import type { EditorAsset } from "~/editor/store";

export function ArollMiniPlayer({
  asset,
  playing,
  onToggle,
}: {
  asset: EditorAsset;
  playing: boolean;
  onToggle: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const separated = asset.mask != null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      void video.play().catch(() => {
        /* autoplay / decode errors — parent clears via onEnded path */
      });
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [playing]);

  return (
    <button
      type="button"
      className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-black"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={playing ? "Pause preview" : "Play preview"}
    >
      <video
        ref={videoRef}
        src={asset.playbackUrl}
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        onEnded={onToggle}
      />
      {!playing ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
          <Play className="size-3.5 text-white drop-shadow" fill="currentColor" />
        </span>
      ) : null}
      {separated ? (
        <span
          className="pointer-events-none absolute right-0.5 bottom-0.5 z-10 flex size-4 items-center justify-center rounded-sm bg-black/70 text-white"
          title="Background separated"
          aria-label="Background separated"
        >
          <Layers2 className="size-2.5" aria-hidden />
        </span>
      ) : null}
    </button>
  );
}
