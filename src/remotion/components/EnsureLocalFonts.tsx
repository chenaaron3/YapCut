import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

const LOCAL_FACES: {
  family: string;
  file: string;
  weight: string;
  style: "normal" | "italic";
}[] = [
  {
    family: "Clash Display",
    file: "fonts/ClashDisplay-Bold.woff2",
    weight: "700",
    style: "normal",
  },
  {
    family: "Satoshi",
    file: "fonts/Satoshi-Black.woff2",
    weight: "900",
    style: "normal",
  },
  {
    family: "Satoshi",
    file: "fonts/Satoshi-BlackItalic.woff2",
    weight: "900",
    style: "italic",
  },
  {
    family: "Tanker",
    file: "fonts/Tanker-Regular.woff2",
    weight: "400",
    style: "normal",
  },
  {
    family: "Comico",
    file: "fonts/Comico-Regular.woff2",
    weight: "400",
    style: "normal",
  },
  {
    family: "Dancing Script",
    file: "fonts/DancingScript-Bold.woff2",
    weight: "700",
    style: "normal",
  },
  {
    family: "Chillax",
    file: "fonts/Chillax-Bold.woff2",
    weight: "700",
    style: "normal",
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
          `url(${staticFile(spec.file)}) format("woff2")`,
          { weight: spec.weight, style: spec.style, display: "swap" },
        );
        return face
          .load()
          .then((loaded) => {
            if (!cancelled) document.fonts.add(loaded);
          })
          .catch((error: unknown) => {
            console.warn(
              `[EnsureLocalFonts] ${spec.family} ${spec.weight} ${spec.style} failed to load:`,
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
