import { useRef } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { runGesture } from "~/editor/lib/gesture";

export function NumberField({
  label,
  value,
  step,
  min,
  max,
  onLiveChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onLiveChange: (v: number) => void;
}) {
  const endRef = useRef<(() => void) | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
        step={step}
        min={min}
        max={max}
        onFocus={() => {
          endRef.current ??= runGesture();
        }}
        onBlur={() => {
          endRef.current?.();
          endRef.current = null;
        }}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          onLiveChange(next);
        }}
      />
    </div>
  );
}
