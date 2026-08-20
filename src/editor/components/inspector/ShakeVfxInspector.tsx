import { Label } from "~/components/ui/label";
import type { VfxShakeEdit } from "~/domain/project/project-config";
import {
  resolveShakeIntensity,
  SHAKE_INTENSITY_MAX,
  SHAKE_INTENSITY_MIN,
} from "~/domain/vfx/shake";
import { SliderField } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

const PRESETS = [
  { label: "Soft", intensity: 0.007 },
  { label: "Medium", intensity: 0.014 },
  { label: "Hard", intensity: 0.03 },
] as const;

const PRESET_EPS = 0.0005;

export function ShakeVfxInspector({ edit }: { edit: VfxShakeEdit }) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const intensity = resolveShakeIntensity(edit.intensity);
  const activeLabel =
    PRESETS.find((p) => Math.abs(intensity - p.intensity) < PRESET_EPS)
      ?.label ?? null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Preset
        </Label>
        <div className="grid grid-cols-3 gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={cn(
                "rounded px-1.5 py-1 text-[10px] font-medium",
                activeLabel === preset.label
                  ? "bg-primary/20 text-primary"
                  : "bg-panel-2 text-muted-foreground hover:text-foreground",
              )}
              onClick={() =>
                patchEdit(edit.id, { intensity: preset.intensity }, false)
              }
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <SliderField
        label="Intensity"
        value={intensity}
        min={SHAKE_INTENSITY_MIN}
        max={SHAKE_INTENSITY_MAX}
        step={0.001}
        display={`${(intensity * 100).toFixed(1)}%`}
        onLiveChange={(value) => patchEdit(edit.id, { intensity: value }, true)}
        onCommit={(value) => patchEdit(edit.id, { intensity: value }, true)}
      />
    </div>
  );
}
