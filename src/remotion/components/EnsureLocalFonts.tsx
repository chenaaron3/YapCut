import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

const LOCAL_FACES: {
  family: string;
  file: string;
  format: string;
}[] = [
  {
    family: "Bootzy TM",
    file: "fonts/BootzyTM.woff2",
    format: "woff2",
  },
  {
    family: "Scholar Italic",
    file: "fonts/ScholarItalic.woff",
    format: "woff",
  },
];

/**
 * Load bundled caption fonts for Player + Lambda (not covered by Next globals.css).
 */
export function EnsureLocalFonts() {
  const [handle] = useState(() => delayRender("local-caption-fonts"));

  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      LOCAL_FACES.map((spec) => {
        const face = new FontFace(
          spec.family,
          `url(${staticFile(spec.file)}) format("${spec.format}")`,
          { weight: "400", style: "normal", display: "swap" },
        );
        return face
          .load()
          .then((loaded) => {
            if (!cancelled) document.fonts.add(loaded);
          })
          .catch((error: unknown) => {
            console.warn(
              `[EnsureLocalFonts] ${spec.family} failed to load:`,
              error instanceof Error ? error.message : error,
            );
          });
      }),
    ).finally(() => {
      if (!cancelled) continueRender(handle);
    });

    return () => {
      cancelled = true;
    };
  }, [handle]);

  return null;
}
