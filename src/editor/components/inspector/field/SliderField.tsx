import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { beginPointerGesture } from "~/editor/lib/gesture";

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
        onPointerDown={() => {
          beginPointerGesture();
        }}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? Number(v[0]) : Number(v);
          if (Number.isFinite(next)) onLiveChange(next);
        }}
        onValueCommitted={(v) => {
          const next = Array.isArray(v) ? Number(v[0]) : Number(v);
          if (Number.isFinite(next)) onCommit(next);
        }}
      />
    </div>
  );
}
