import { useRef } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { runGesture } from "~/editor/lib/gesture";

export function TextField({
  label,
  value,
  id,
  onLiveChange,
  multiline = false,
}: {
  label: string;
  value: string;
  id?: string;
  onLiveChange: (v: string) => void;
  multiline?: boolean;
}) {
  const endRef = useRef<(() => void) | null>(null);
  const onFocus = () => {
    endRef.current ??= runGesture();
  };
  const onBlur = () => {
    endRef.current?.();
    endRef.current = null;
  };

  return (
    <div className="flex flex-col gap-1">
      <Label
        htmlFor={id}
        className="text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </Label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onLiveChange(e.target.value)}
          className="min-h-8 resize-none py-1"
        />
      ) : (
        <Input
          id={id}
          type="text"
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onLiveChange(e.target.value)}
        />
      )}
    </div>
  );
}
