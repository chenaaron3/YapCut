import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Load bundled caption fonts for Player + Lambda (not covered by Next globals.css).
 */
export function EnsureLocalFonts() {
  const [handle] = useState(() => delayRender("local-caption-fonts"));

  useEffect(() => {
    let cancelled = false;
    const face = new FontFace(
      "Bootzy TM",
      `url(${staticFile("fonts/BootzyTM.woff2")}) format("woff2")`,
      { weight: "400", style: "normal", display: "swap" },
    );

    face
      .load()
      .then((loaded) => {
        if (cancelled) return;
        document.fonts.add(loaded);
      })
      .catch((error: unknown) => {
        console.warn(
          "[EnsureLocalFonts] Bootzy TM failed to load:",
          error instanceof Error ? error.message : error,
        );
      })
      .finally(() => {
        if (!cancelled) continueRender(handle);
      });

    return () => {
      cancelled = true;
    };
  }, [handle]);

  return null;
}
