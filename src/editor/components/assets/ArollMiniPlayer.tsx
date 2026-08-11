"use client";

import { useEffect, useRef } from "react";
import { Play } from "lucide-react";

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
    </button>
  );
}
