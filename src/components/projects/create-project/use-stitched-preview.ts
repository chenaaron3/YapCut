import { useEffect, useRef, useState } from "react";

import type { ClipItem } from "~/components/projects/create-project/types";

function clipDurations(clips: ClipItem[]): number[] {
  return clips.map((clip) =>
    clip.durationSec != null && Number.isFinite(clip.durationSec)
      ? clip.durationSec
      : 0,
  );
}

export function useStitchedPreview(
  clips: ClipItem[],
  activeId: string | null,
  onActiveChange: (id: string) => void,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const resumePlayRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [measuredSec, setMeasuredSec] = useState(0);

  const activeIndex = Math.max(
    0,
    clips.findIndex((clip) => clip.id === activeId),
  );
  const activeClip = clips[activeIndex] ?? clips[0] ?? null;
  const durations = clipDurations(clips).map((duration, index) =>
    index === activeIndex && measuredSec > 0 ? measuredSec : duration,
  );
  const offsetSec = durations
    .slice(0, Math.max(activeIndex, 0))
    .reduce((sum, value) => sum + value, 0);
  const totalSec = durations.reduce((sum, value) => sum + value, 0);
  const timelineSec = offsetSec + currentSec;
  const clipId = activeClip?.id;
  const previewUrl = activeClip?.previewUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clipId || !previewUrl) {
      setPlaying(false);
      setCurrentSec(0);
      setMeasuredSec(0);
      return;
    }
    video.src = previewUrl;
    const seekTo = pendingSeekRef.current;
    const shouldPlay = resumePlayRef.current;
    pendingSeekRef.current = null;
    resumePlayRef.current = false;
    const startAt = seekTo ?? 0;
    const showFrame = () => {
      video.currentTime = startAt > 0 ? startAt : 0.001;
      setCurrentSec(startAt);
      if (shouldPlay) {
        void video.play().catch(() => setPlaying(false));
        return;
      }
      video.pause();
      setPlaying(false);
    };
    if (video.readyState >= 1) {
      showFrame();
      return;
    }
    video.addEventListener("loadedmetadata", showFrame, { once: true });
    return () => video.removeEventListener("loadedmetadata", showFrame);
  }, [clipId, previewUrl]);

  const playNext = () => {
    if (clips.length === 0) return;
    const nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % clips.length;
    const next = clips[nextIndex];
    if (!next) return;
    if (next.id === activeId) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        void video.play().catch(() => undefined);
      }
      return;
    }
    pendingSeekRef.current = 0;
    resumePlayRef.current = true;
    onActiveChange(next.id);
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  };
  const togglePlaybackRef = useRef(togglePlayback);
  togglePlaybackRef.current = togglePlayback;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " && event.code !== "Space") return;
      if (event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      togglePlaybackRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const seekTimeline = (nextTimelineSec: number) => {
    if (clips.length === 0 || totalSec <= 0) return;
    const clamped = Math.min(Math.max(nextTimelineSec, 0), totalSec);
    let cursor = 0;
    for (let index = 0; index < clips.length; index++) {
      const duration = durations[index] ?? 0;
      const end = cursor + duration;
      const isLast = index === clips.length - 1;
      if (clamped < end || isLast) {
        const local = Math.max(0, clamped - cursor);
        const clip = clips[index];
        if (!clip) return;
        if (clip.id === activeId) {
          const video = videoRef.current;
          if (video) video.currentTime = local;
          setCurrentSec(local);
        } else {
          pendingSeekRef.current = local;
          resumePlayRef.current = playing;
          onActiveChange(clip.id);
        }
        return;
      }
      cursor = end;
    }
  };

  return {
    videoRef,
    activeClip,
    playing,
    setPlaying,
    muted,
    setMuted,
    measuredSec,
    setMeasuredSec,
    currentSec,
    setCurrentSec,
    totalSec,
    timelineSec,
    playNext,
    togglePlayback,
    seekTimeline,
  };
}
