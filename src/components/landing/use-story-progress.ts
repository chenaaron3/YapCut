"use client";

import { useEffect, useState } from "react";

export function useStoryProgress(ids: readonly string[]) {
  const [progress, setProgress] = useState<number[]>(() => ids.map(() => 0));
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const measure = () => {
      const vh = window.innerHeight;
      const focus = vh / 2;
      const next = ids.map((id) => {
        const el = document.getElementById(id);
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        // 0: track top meets viewport top. 1: track middle meets viewport middle.
        const endTop = focus - r.height / 2;
        const denom = Math.max(0 - endTop, 1);
        if (reduce) return r.top + r.height / 2 <= focus ? 1 : 0;
        return Math.min(1, Math.max(0, (0 - r.top) / denom));
      });
      setProgress(next);

      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const mid = r.top + r.height / 2;
        const dist = Math.abs(mid - focus);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setActive(best);
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
  }, [ids]);

  return { progress, active };
}

export function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

export function spanProgress(p: number, start: number, end: number) {
  if (end <= start) return p >= start ? 1 : 0;
  return Math.min(1, Math.max(0, (p - start) / (end - start)));
}
