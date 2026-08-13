import { Children, type ReactNode } from "react";

export const STACK_GAP_PX = 0;

/**
 * Hugging column of overlay lines (heading + subheading).
 * Earlier children paint above later ones so the heading stays in front when
 * line `y` pulls them into overlap.
 */
export function StackedCaptionPair({
  gap = STACK_GAP_PX,
  children,
}: {
  gap?: number;
  children: ReactNode;
}) {
  const items = Children.toArray(children);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap,
      }}
    >
      {items.map((child, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            zIndex: items.length - i,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
