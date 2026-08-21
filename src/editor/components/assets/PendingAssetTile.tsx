import { Loader2 } from "lucide-react";

import { PickerTile } from "~/editor/components/picker";
import { cn } from "~/lib/utils";

import type { PendingUpload } from "~/editor/components/assets/useAssetUpload";

function pendingLabel(filename: string, stripExt: boolean): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  return stripExt ? base.replace(/\.[^.]+$/, "") : base;
}

/** Display-only optimistic thumb while an upload is in flight. */
export function PendingAssetTile({
  pending,
  fillThumb = false,
  stripExt = false,
  thumbClassName,
}: {
  pending: PendingUpload;
  fillThumb?: boolean;
  stripExt?: boolean;
  thumbClassName?: string;
}) {
  const label = pendingLabel(pending.filename, stripExt);

  return (
    <PickerTile
      label={label}
      title={`${label} (importing…)`}
      fillThumb={fillThumb}
      className="pointer-events-none opacity-50"
      thumbClassName={cn("relative", thumbClassName)}
    >
      {pending.kind === "image" ? (
        <img
          src={pending.previewUrl}
          alt=""
          draggable={false}
          className="size-full object-cover"
        />
      ) : null}
      {pending.kind === "video" ? (
        <video
          src={pending.previewUrl}
          muted
          playsInline
          preload="metadata"
          draggable={false}
          className="size-full object-cover"
        />
      ) : null}
      <span
        className="absolute inset-0 flex items-center justify-center bg-black/20"
        aria-hidden
      >
        <Loader2 className="size-4 animate-spin text-white drop-shadow" />
      </span>
    </PickerTile>
  );
}
