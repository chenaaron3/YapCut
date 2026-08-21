import { useMemo, useState } from "react";

import { sfxPlaybackVolume } from "~/domain/audio/mix-levels";
import {
  DEFAULT_SFX_VOLUME,
  formatSfxLabel,
  SFX_DRAG_MIME,
  SFX_FOLDER_ORDER,
  sfxFolderLabel,
  sfxFolderOf,
} from "~/domain/edit/sfx";
import { useAudioPreview } from "~/editor/components/assets/useAudioPreview";
import { InspectorCollapsible } from "~/editor/components/inspector/field/InspectorCollapsible";
import { matchesSfxQuery } from "~/editor/components/inspector/field/sfx-search";
import {
  PickerEmpty,
  PickerGrid,
  PickerTile,
} from "~/editor/components/picker";
import {
  beginAssetPlaceDrag,
  endAssetPlaceDrag,
} from "~/editor/lib/place/asset-place-drag";

import type { SfxDragPayload } from "~/domain/edit/sfx";
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
  const [query, setQuery] = useState("");
  const { playingKey, preview } = useAudioPreview();
  const filtered = useMemo(
    () => assets.filter((asset) => matchesSfxQuery(asset, query)),
    [assets, query],
  );
  const groups = useMemo(() => groupSfx(filtered), [filtered]);
  const searching = query.trim().length > 0;

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
    <div className="flex flex-col">
      <div className="bg-panel sticky top-0 z-10 border-b border-[#2A2F3C] px-2 pt-2 pb-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search SFX"
          className="border-border bg-panel-2 w-full rounded-md border px-2 py-1 text-[11px] text-[#F5F9CE] outline-none placeholder:text-[#8B90A0]"
        />
      </div>
      <div className="px-2 pb-2">
        {groups.map((group) => {
          const key = group.folder ?? "__other__";
          return (
            <InspectorCollapsible
              key={key}
              title={group.label}
              defaultOpen
              accessory={
                <span className="text-[10px] text-muted-foreground/70">
                  {group.assets.length}
                </span>
              }
              contentClassName="gap-0 pt-2"
            >
              <PickerGrid>
                {group.assets.map((asset) => (
                  <SfxTile
                    key={asset.id}
                    asset={asset}
                    playingKey={playingKey}
                    onPreview={preview}
                  />
                ))}
              </PickerGrid>
            </InspectorCollapsible>
          );
        })}
        {searching && groups.length === 0 ? (
          <PickerEmpty>No SFX match.</PickerEmpty>
        ) : null}
      </div>
    </div>
  );
}
