import type { CSSProperties, FC } from "react";

import type { TransitionClipProp } from "~/remotion/helpers/types";

export type TransitionPainter = {
  /** Easing for open/close and interior clip progress. */
  ease?: (t: number) => number;
  /** Opening/closing/interior look on the picture stack. Omit = identity. */
  pictureStyle?: (
    p: number,
    mode: "opening" | "closing" | "interior",
  ) => CSSProperties;
  /** Painted above the picture for this clip’s range (Sequence-local time). */
  Overlay: FC<{ clip: TransitionClipProp }>;
};
