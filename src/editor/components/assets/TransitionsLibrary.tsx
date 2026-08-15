import { PanelRight, ScanSearch, Zap } from "lucide-react";

import { TRANSITION_DRAG_MIME, TRANSITION_PRESETS } from "~/domain/transition";
import { useTranscriptUi } from "~/editor/transcript-ui-store";

import type {
  TransitionDragPayload,
  TransitionTemplateId,
} from "~/domain/transition";

const PRESET_ICON: Record<TransitionTemplateId, typeof Zap> = {
  flash: Zap,
  flashZoom: ScanSearch,
  slide: PanelRight,
};

function TransitionPresetRow({ preset }: { preset: TransitionDragPayload }) {
  const Icon = PRESET_ICON[preset.templateId];
  const setTransitionDragActive = useTranscriptUi(
    (s) => s.setTransitionDragActive,
  );
  return (
    <div
      className="border-border bg-panel-2 flex cursor-grab items-center gap-2 rounded-lg border px-2 py-1.5 select-none active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(TRANSITION_DRAG_MIME, JSON.stringify(preset));
        e.dataTransfer.effectAllowed = "copy";
        setTransitionDragActive(true);
      }}
      onDragEnd={() => setTransitionDragActive(false)}
      title={preset.label}
    >
      <span className="bg-transition/25 text-transition flex h-7 w-7 shrink-0 items-center justify-center rounded">
        <Icon className="size-3.5" />
      </span>
      <span className="text-foreground min-w-0 flex-1 truncate text-[11px]">
        {preset.label}
      </span>
    </div>
  );
}

export function TransitionsLibrary() {
  return (
    <div className="flex flex-col gap-1 p-2">
      {TRANSITION_PRESETS.map((preset) => (
        <TransitionPresetRow key={preset.templateId} preset={preset} />
      ))}
    </div>
  );
}
