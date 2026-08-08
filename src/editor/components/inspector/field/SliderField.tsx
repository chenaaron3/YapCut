import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { useEditor } from "~/editor/store";

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onLiveChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onLiveChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label} · {display}
      </Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onPointerDown={() => useEditor.getState().beginGesture()}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : v;
          if (typeof next === "number") onLiveChange(next);
        }}
        onValueCommitted={(v) => {
          const next = Array.isArray(v) ? v[0] : v;
          if (typeof next === "number") onCommit(next);
        }}
      />
    </div>
  );
}
