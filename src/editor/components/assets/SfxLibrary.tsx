import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import {
  DEFAULT_SFX_VOLUME,
  SFX_DRAG_MIME,
  type SfxDragPayload,
} from "~/domain/sfx";
import { useAudioPreview } from "~/editor/components/assets/useAudioPreview";
import type { EditorAsset } from "~/editor/store";
import { cn } from "~/lib/utils";

const FOLDER_ORDER = ["meme", "beep-bop", "realistic", "general"] as const;

const FOLDER_LABELS: Record<string, string> = {
  meme: "Meme",
  "beep-bop": "Beep Bop",
  realistic: "Realistic",
  general: "General",
};

function folderOf(filename: string | null): string | null {
  if (!filename) return null;
  const parts = filename.split("/");
  return parts.length >= 2 ? (parts[0] ?? null) : null;
}

function labelOf(filename: string | null, id: string): string {
  if (!filename) return id.slice(0, 8);
  return filename.split("/").pop() ?? filename;
}

function groupSfx(assets: EditorAsset[]) {
  const groups = new Map<string | null, EditorAsset[]>();
  for (const asset of assets) {
    const key = folderOf(asset.originalFilename);
    const list = groups.get(key) ?? [];
    list.push(asset);
    groups.set(key, list);
  }

  const ordered: Array<{
    folder: string | null;
    label: string;
    assets: EditorAsset[];
  }> = [];

  for (const folder of FOLDER_ORDER) {
    const list = groups.get(folder);
    if (!list?.length) continue;
    ordered.push({
      folder,
      label: FOLDER_LABELS[folder] ?? folder,
      assets: list,
    });
    groups.delete(folder);
  }
  for (const [folder, list] of groups) {
    if (!list.length) continue;
    ordered.push({
      folder,
      label: folder ? (FOLDER_LABELS[folder] ?? folder) : "Other",
      assets: list,
    });
  }
  return ordered;
}

function SfxRow({
  asset,
  playingKey,
  onPreview,
}: {
  asset: EditorAsset;
  playingKey: string | null;
  onPreview: (key: string, src: string, volume?: number) => void;
}) {
  const label = labelOf(asset.originalFilename, asset.id);
  const canDrag = asset.kind === "audio" && asset.playbackUrl.length > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-panel-2 px-2 py-1.5 select-none",
        canDrag && "cursor-grab active:cursor-grabbing",
      )}
      draggable={canDrag}
      onDragStart={(e) => {
        if (!canDrag) return;
        const payload: SfxDragPayload = {
          assetId: asset.id,
          durationSec: asset.durationSec,
          label,
        };
        e.dataTransfer.setData(SFX_DRAG_MIME, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={
        asset.durationSec != null
          ? `${label} (${asset.durationSec.toFixed(2)}s)`
          : label
      }
    >
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-sfx/25 text-sfx hover:bg-sfx/40"
        onClick={(e) => {
          e.stopPropagation();
          onPreview(asset.id, asset.playbackUrl, DEFAULT_SFX_VOLUME);
        }}
        title={playingKey === asset.id ? "Stop" : "Preview"}
      >
        {playingKey === asset.id ? "■" : "▶"}
      </button>
      <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
        {label}
      </span>
      {asset.durationSec != null ? (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {asset.durationSec.toFixed(1)}s
        </span>
      ) : null}
    </div>
  );
}

export function SfxLibrary({ assets }: { assets: EditorAsset[] }) {
  const { playingKey, preview } = useAudioPreview();
  const groups = useMemo(() => groupSfx(assets), [assets]);
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of FOLDER_ORDER) init[g] = true;
    return init;
  });

  if (assets.length === 0) {
    return (
      <p className="p-2.5 text-xs text-muted-foreground">
        No global SFX seeded. Run{" "}
        <code className="text-[10px]">npm run seed:global-sfx</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {groups.map((group) => {
        const key = group.folder ?? "__other__";
        const isOpen = open[key] ?? true;
        return (
          <div key={key} className="rounded-md border border-border/60">
            <button
              type="button"
              className="flex w-full items-center gap-1 px-2 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
              onClick={() =>
                setOpen((prev) => ({ ...prev, [key]: !isOpen }))
              }
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform",
                  isOpen && "rotate-90",
                )}
              />
              {group.label}
              <span className="ml-auto text-[10px] opacity-70">
                {group.assets.length}
              </span>
            </button>
            {isOpen ? (
              <div className="flex flex-col gap-1 px-1.5 pb-1.5">
                {group.assets.map((asset) => (
                  <SfxRow
                    key={asset.id}
                    asset={asset}
                    playingKey={playingKey}
                    onPreview={preview}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      <p className="px-1 pt-1 text-[10px] text-muted-foreground">
        Drag onto the transcript to place.
      </p>
    </div>
  );
}
