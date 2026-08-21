import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { CaptionGroupView } from "./CaptionGroupView";

import type { CaptionGroupProp } from "~/remotion/helpers/types";

export type CompositeItem = {
  group: CaptionGroupProp;
  /** Fraction of the previous sibling's height. First child ignores this. */
  localY: number;
  /**
   * Captions/quotes: cycle past/active/future paint.
   * Overlay: false — group motion owns enter; words stay in layout.
   */
  cycleWordStates: boolean;
  visible?: boolean;
  frame: number;
};

export type CompositeGroupLayoutProps = {
  layout: "stack" | "series";
  items: CompositeItem[];
  fps: number;
};

function StackChild({
  localY,
  prevHeight,
  zIndex,
  visible,
  onHeight,
  children,
}: {
  localY: number;
  prevHeight: number;
  zIndex: number;
  visible: boolean;
  onHeight: (h: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const report = () => onHeight(node.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(node);
    return () => ro.disconnect();
  });

  // Opacity, not visibility: typewriter letters set visibility:visible on
  // glyphs, which would punch through a parent with visibility:hidden.
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        zIndex,
        opacity: visible ? 1 : 0,
        marginTop: localY * prevHeight,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Places 1:N groups relative to each other. Does not know about the world.
 * `stack` — column; `localY` is a fraction of the previous group's height.
 * `series` — same cell (overlay heading then subheading, not stacked).
 */
export function CompositeGroupLayout({
  layout,
  items,
  fps,
}: CompositeGroupLayoutProps) {
  const [heights, setHeights] = useState<number[]>([]);

  if (items.length === 0) return null;

  const views = items.map((item, i) => (
    <CaptionGroupView
      key={i}
      group={item.group}
      frame={item.frame}
      fps={fps}
      cycleWordStates={item.cycleWordStates}
    />
  ));

  if (layout === "series") {
    return (
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          alignItems: "center",
        }}
      >
        {views.map((view, i) => (
          <div
            key={i}
            style={{
              gridArea: "1 / 1",
              position: "relative",
              zIndex: items.length - i,
              // Opacity: typewriter glyph visibility:visible punches through
              // parent visibility:hidden (CSS exception for visibility).
              opacity: items[i]!.visible === false ? 0 : 1,
            }}
          >
            {view}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {views.map((view, i) => (
        <StackChild
          key={i}
          localY={i === 0 ? 0 : items[i]!.localY}
          prevHeight={i === 0 ? 0 : (heights[i - 1] ?? 0)}
          zIndex={items.length - i}
          visible={items[i]!.visible !== false}
          onHeight={(h) => {
            setHeights((prev) => {
              if (prev[i] === h) return prev;
              const next = prev.slice();
              next[i] = h;
              return next;
            });
          }}
        >
          {view}
        </StackChild>
      ))}
    </div>
  );
}
