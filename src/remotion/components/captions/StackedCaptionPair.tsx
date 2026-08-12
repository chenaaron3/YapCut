import type { ReactNode } from "react";

export const STACK_GAP_PX = 10;

/** Centered column of caption layers (title + subheading, stacked listicle). */
export function StackedCaptionPair({
  y,
  children,
}: {
  y: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${y * 100}%`,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: STACK_GAP_PX,
        transform: "translateY(-50%)",
      }}
    >
      {children}
    </div>
  );
}
