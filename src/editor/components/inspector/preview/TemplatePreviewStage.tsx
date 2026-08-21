import { useLayoutEffect, useRef, useState } from "react";

import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";

import type { ReactNode } from "react";

/** Scaled composition viewport for inspector template previews. */
export function TemplatePreviewStage({
  focusY,
  className,
  children,
}: {
  focusY: number;
  className?: string;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offsetY, setOffsetY] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextScale = cw / COMPOSITION_WIDTH;
      setScale(nextScale);
      setOffsetY(ch / 2 - focusY * COMPOSITION_HEIGHT * nextScale);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [focusY]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: 128,
        overflow: "hidden",
        background: "linear-gradient(180deg, #2a2f3a 0%, #1a1d26 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: offsetY,
          width: COMPOSITION_WIDTH,
          height: COMPOSITION_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
