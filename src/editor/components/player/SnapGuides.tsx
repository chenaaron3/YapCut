import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";

import type { SnapGuide } from "~/domain/edit/transform";

export function SnapGuides({ guides }: { guides: readonly SnapGuide[] }) {
  return (
    <>
      {guides.map((g) =>
        g.orientation === "x" ? (
          <div
            key={`x-${g.pos}`}
            className="bg-primary/80 absolute top-0 bottom-0 w-px"
            style={{ left: `${(g.pos / COMPOSITION_WIDTH) * 100}%` }}
          />
        ) : (
          <div
            key={`y-${g.pos}`}
            className="bg-primary/80 absolute right-0 left-0 h-px"
            style={{ top: `${(g.pos / COMPOSITION_HEIGHT) * 100}%` }}
          />
        ),
      )}
    </>
  );
}
