import { ListOrdered, Quote, Sparkles, Type, Vibrate } from "lucide-react";

import { VFX_DRAG_MIME, VFX_PRESETS } from "~/domain/vfx";
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

function VfxPresetRow({ preset }: { preset: VfxDragPayload }) {
  const Icon = PRESET_ICON[preset.type];
  return (
    <div
      className="border-border bg-panel-2 flex cursor-grab items-center gap-2 rounded-lg border px-2 py-1.5 select-none active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(VFX_DRAG_MIME, JSON.stringify(preset));
        beginAssetPlaceDrag(e, "vfx", PRESET_CHROME[preset.type]);
      }}
      onDragEnd={endAssetPlaceDrag}
      title={preset.label}
    >
      <span className="bg-vfx/25 text-vfx flex h-7 w-7 shrink-0 items-center justify-center rounded">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-[#F5F9CE]">
        {preset.label}
      </span>
    </div>
  );
}

export function VfxLibrary() {
  return (
    <div className="flex flex-col gap-1 p-2">
      {VFX_PRESETS.map((preset) => (
        <VfxPresetRow key={preset.type} preset={preset} />
      ))}
    </div>
  );
}
