"use client";

import { useEffect, useRef, useState } from "react";

export function usePinnedStory(stepCount: number) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const total = Math.max(rect.height - window.innerHeight, 1);
      const next = Math.min(1, Math.max(0, -rect.top / total));
      const index = Math.min(stepCount - 1, Math.max(0, Math.floor(next * stepCount)));
      setActive(index);
      setProgress(reduce ? (index + 0.99) / stepCount : next);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [stepCount]);

  const scrollToStep = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const total = Math.max(track.offsetHeight - window.innerHeight, 1);
    const t = (index + 0.35) / stepCount;
    window.scrollTo({ top: top + total * t, behavior: "smooth" });
  };

  return { trackRef, progress, active, scrollToStep };
}

export function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

export function spanProgress(p: number, start: number, end: number) {
  if (end <= start) return p >= start ? 1 : 0;
  return Math.min(1, Math.max(0, (p - start) / (end - start)));
}
