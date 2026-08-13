import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import { TRANSFORM_HANDLE_CLASS } from "~/editor/components/player/transform-overlay";

export function TransformHandles({
  scale,
  onRotate,
  onScale,
}: {
  /** Parent box scale — handles apply `1/scale` so screen size stays constant. */
  scale: number;
  onRotate: (e: ReactPointerEvent) => void;
  onScale: (e: ReactPointerEvent) => void;
}) {
  const inv = 1 / Math.max(scale, 0.01);
  const handleCounter: CSSProperties = { transform: `scale(${inv})` };
  // Inline transform must include the stem's translate (overrides Tailwind).
  const stemCounter: CSSProperties = {
    transform: `translate(-50%, -100%) scale(${inv})`,
  };

  return (
    <>
      <div
        className="absolute top-0 left-1/2 flex h-7 flex-col items-center"
        style={stemCounter}
      >
        <button
          type="button"
          aria-label="Rotate"
          className="bg-primary pointer-events-auto mb-1 h-2.5 w-2.5 rounded-full border border-white"
          onPointerDown={onRotate}
        />
        <div className="bg-primary/80 h-full w-px" />
      </div>

      {(
        [
          ["-left-1 -top-1", "cursor-nwse-resize"],
          ["-right-1 -top-1", "cursor-nesw-resize"],
          ["-left-1 -bottom-1", "cursor-nesw-resize"],
          ["-right-1 -bottom-1", "cursor-nwse-resize"],
        ] as const
      ).map(([pos, cursor]) => (
        <button
          key={pos}
          type="button"
          aria-label="Scale"
          className={`${TRANSFORM_HANDLE_CLASS} pointer-events-auto ${pos} ${cursor}`}
          style={handleCounter}
          onPointerDown={onScale}
        />
      ))}
    </>
  );
}
