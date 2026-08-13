import type { ReactNode } from "react";

export const STACK_GAP_PX = 8;

/** Hugging column of overlay lines (heading + subheading). */
export function StackedCaptionPair({
  gap = STACK_GAP_PX,
  children,
}: {
  gap?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap,
      }}
    >
      {children}
    </div>
  );
}
