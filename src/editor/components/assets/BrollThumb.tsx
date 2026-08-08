import type { EditorAsset } from "~/editor/store";
import { cn } from "~/lib/utils";

export function BrollThumb({
  asset,
  className,
}: {
  asset: EditorAsset;
  className?: string;
}) {
  if (asset.kind === "video") {
    return (
      <video
        src={asset.playbackUrl}
        muted
        playsInline
        preload="metadata"
        className={cn("aspect-square w-full bg-black object-cover", className)}
      />
    );
  }
  return (
    <img
      src={asset.playbackUrl}
      alt={asset.originalFilename ?? "b-roll"}
      className={cn("aspect-square w-full bg-black object-cover", className)}
    />
  );
}
