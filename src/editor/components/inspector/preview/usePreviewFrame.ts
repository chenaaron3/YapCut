import { useEffect, useState } from "react";

import { PREVIEW_FPS } from "~/editor/components/inspector/preview/constants";

/** RAF clock for template picker previews. */
export function usePreviewFrame(
  playing: boolean,
  cycleLen: number,
  idleFrame: number,
  /** Changing this restarts the loop (e.g. hovered template id). */
  restartKey = "",
): number {
  const [frame, setFrame] = useState(idleFrame);

  useEffect(() => {
    if (!playing) {
      setFrame(idleFrame);
      return;
    }
    setFrame(0);
    let current = 0;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      if (now - last >= 1000 / PREVIEW_FPS) {
        last = now;
        current = (current + 1) % cycleLen;
        setFrame(current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, cycleLen, idleFrame, restartKey]);

  return frame;
}
