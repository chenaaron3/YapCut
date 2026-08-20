import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { sfxPlaybackVolume } from "~/domain/audio/mix-levels";
import {
  DEFAULT_SFX_VOLUME,
  formatSfxLabel,
  SFX_DRAG_MIME,
  SFX_FOLDER_ORDER,
  sfxFolderLabel,
  sfxFolderOf,
} from "~/domain/sfx";
import { useAudioPreview } from "~/editor/components/assets/useAudioPreview";
import {
  PickerEmpty,
  PickerGrid,
  PickerTile,
} from "~/editor/components/picker";
import {
  beginAssetPlaceDrag,
  endAssetPlaceDrag,
} from "~/editor/lib/asset-place-drag";
import { cn } from "~/lib/utils";

import type { SfxDragPayload } from "~/domain/sfx";
import type { EditorAsset } from "~/editor/store";

function groupSfx(assets: EditorAsset[]) {
  const groups = new Map<string | null, EditorAsset[]>();
  for (const asset of assets) {
    const key = sfxFolderOf(asset.originalFilename);
    const list = groups.get(key) ?? [];
    list.push(asset);
    groups.set(key, list);
  }

  const ordered: Array<{
    folder: string | null;
    label: string;
    assets: EditorAsset[];
  }> = [];

  for (const folder of SFX_FOLDER_ORDER) {
    const list = groups.get(folder);
    if (!list?.length) continue;
    ordered.push({
      folder,
      label: sfxFolderLabel(folder),
      assets: list,
    });
    groups.delete(folder);
  }
  for (const [folder, list] of groups) {
    if (!list.length) continue;
    ordered.push({
      folder,
      label: folder ? sfxFolderLabel(folder) : "Other",
      assets: list,
    });
  }
  return ordered;
}

function SfxTile({
  asset,
  playingKey,
  onPreview,
}: {
  asset: EditorAsset;
  playingKey: string | null;
  onPreview: (key: string, src: string, volume?: number) => void;
}) {
  const label = formatSfxLabel(asset.originalFilename, asset.id);
  const canDrag = asset.kind === "audio" && asset.playbackUrl.length > 0;
  const playing = playingKey === asset.id;

  return (
    <PickerTile
      label={label}
      draggable={canDrag}
      thumbClassName="bg-sfx/25 text-sfx"
      onDragStart={(e) => {
        if (!canDrag) return;
        const payload: SfxDragPayload = {
          assetId: asset.id,
          durationSec: asset.durationSec,
          label,
        };
        e.dataTransfer.setData(SFX_DRAG_MIME, JSON.stringify(payload));
        beginAssetPlaceDrag(e, "sfx", "sfx");
      }}
      onDragEnd={endAssetPlaceDrag}
      title={
        asset.durationSec != null
          ? `${label} (${asset.durationSec.toFixed(2)}s)`
          : label
      }
    >
      <button
        type="button"
        className="flex size-full items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          onPreview(
            asset.id,
            asset.playbackUrl,
            sfxPlaybackVolume(DEFAULT_SFX_VOLUME, asset.lufs, asset.truePeakDb),
          );
        }}
        title={playing ? "Stop" : "Preview"}
      >
        {playing ? "■" : "▶"}
      </button>
    </PickerTile>
  );
}

export function SfxLibrary({ assets }: { assets: EditorAsset[] }) {
  const { playingKey, preview } = useAudioPreview();
  const groups = useMemo(() => groupSfx(assets), [assets]);
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of SFX_FOLDER_ORDER) init[g] = true;
    return init;
  });

  if (assets.length === 0) {
    return (
      <PickerGrid className="p-2">
        <PickerEmpty>
          No global SFX seeded. Run{" "}
          <code className="text-[10px]">npm run seed:global</code>.
        </PickerEmpty>
      </PickerGrid>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {groups.map((group) => {
        const key = group.folder ?? "__other__";
        const isOpen = open[key] ?? true;
        return (
          <div key={key} className="border-border/60 rounded-md border">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 px-2 py-1.5 text-left text-[11px] font-medium"
              onClick={() => setOpen((prev) => ({ ...prev, [key]: !isOpen }))}
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
              <PickerGrid className="px-1.5 pb-1.5">
                {group.assets.map((asset) => (
                  <SfxTile
                    key={asset.id}
                    asset={asset}
                    playingKey={playingKey}
                    onPreview={preview}
                  />
                ))}
              </PickerGrid>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
