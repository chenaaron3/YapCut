import type { ReactNode } from "react";

/**
 * Fixed-width slot between transcript chrome (markers / words).
 * Empty → spacer; with a handle → same width (no layout jitter).
 * Adjacent empty slots collapse via `[data-word-gap]` rules in globals.css.
 */
export function WordGap({ children }: { children?: ReactNode }) {
  return (
    <span
      data-word-gap
      className="relative inline-flex h-[1.25em] w-[0.3em] shrink-0 items-center justify-center align-middle"
    >
      {children}
    </span>
  );
}
