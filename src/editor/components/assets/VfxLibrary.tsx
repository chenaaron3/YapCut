import { ListOrdered, Quote, Sparkles, Type, Vibrate } from "lucide-react";

import { VFX_DRAG_MIME, VFX_PRESETS } from "~/domain/vfx";
import { PickerGrid, PickerTile } from "~/editor/components/picker";
import {
  beginAssetPlaceDrag,
  endAssetPlaceDrag,
} from "~/editor/lib/asset-place-drag";

import type { VfxDragPayload, VfxPresetType } from "~/domain/vfx";
import type { EditChromeKey } from "~/editor/lib/edit-chrome";

const PRESET_ICON: Record<VfxPresetType, typeof Quote> = {
  quote: Quote,
  text: Type,
  listicle: ListOrdered,
  shake: Vibrate,
  motion: Sparkles,
};

const PRESET_CHROME: Record<VfxPresetType, EditChromeKey> = {
  quote: "vfx:quote",
  text: "vfx:text",
  listicle: "vfx:listicle",
  shake: "vfx:shake",
  motion: "vfx:motion",
};

function VfxPresetTile({ preset }: { preset: VfxDragPayload }) {
  const Icon = PRESET_ICON[preset.type];
  return (
    <PickerTile
      label={preset.label}
      draggable
      thumbClassName="bg-vfx/25 text-vfx"
      onDragStart={(e) => {
        e.dataTransfer.setData(VFX_DRAG_MIME, JSON.stringify(preset));
        beginAssetPlaceDrag(e, "vfx", PRESET_CHROME[preset.type]);
      }}
      onDragEnd={endAssetPlaceDrag}
    >
      <Icon className="size-3.5" />
    </PickerTile>
  );
}

export function VfxLibrary() {
  return (
    <PickerGrid className="p-2">
      {VFX_PRESETS.map((preset) => (
        <VfxPresetTile key={preset.type} preset={preset} />
      ))}
    </PickerGrid>
  );
}
