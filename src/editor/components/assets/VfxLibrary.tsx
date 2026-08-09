import { ListOrdered, Quote, Type } from "lucide-react";

import {
  VFX_DRAG_MIME,
  VFX_PRESETS,
  type VfxDragPayload,
  type VfxPresetType,
} from "~/domain/vfx";

const PRESET_ICON: Record<VfxPresetType, typeof Quote> = {
  quote: Quote,
  text: Type,
  listicle: ListOrdered,
};

function VfxPresetRow({ preset }: { preset: VfxDragPayload }) {
  const Icon = PRESET_ICON[preset.type];
  return (
    <div
      className="flex cursor-grab items-center gap-2 rounded-lg border border-border bg-panel-2 px-2 py-1.5 select-none active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(VFX_DRAG_MIME, JSON.stringify(preset));
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={preset.label}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-vfx/25 text-vfx">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
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
