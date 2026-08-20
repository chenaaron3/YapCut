import { PanelRight, ScanSearch, Zap } from "lucide-react";

import { TRANSITION_DRAG_MIME, TRANSITION_PRESETS } from "~/domain/transition";
import { PickerGrid, PickerTile } from "~/editor/components/picker";
import {
  beginAssetPlaceDrag,
  endAssetPlaceDrag,
} from "~/editor/lib/asset-place-drag";

import type {
  TransitionDragPayload,
  TransitionTemplateId,
} from "~/domain/transition";

const PRESET_ICON: Record<TransitionTemplateId, typeof Zap> = {
  flash: Zap,
  flashZoom: ScanSearch,
  slide: PanelRight,
};

function TransitionPresetTile({ preset }: { preset: TransitionDragPayload }) {
  const Icon = PRESET_ICON[preset.templateId];
  return (
    <PickerTile
      label={preset.label}
      draggable
      thumbClassName="bg-transition/25 text-transition"
      onDragStart={(e) => {
        e.dataTransfer.setData(TRANSITION_DRAG_MIME, JSON.stringify(preset));
        beginAssetPlaceDrag(e, "transition", "transition");
      }}
      onDragEnd={endAssetPlaceDrag}
    >
      <Icon className="size-3.5" />
    </PickerTile>
  );
}

export function TransitionsLibrary() {
  return (
    <PickerGrid className="p-2">
      {TRANSITION_PRESETS.map((preset) => (
        <TransitionPresetTile key={preset.templateId} preset={preset} />
      ))}
    </PickerGrid>
  );
}
