import { Minus, Plus } from "lucide-react";
import { useRef } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { InspectorCollapsible } from "~/editor/components/inspector/field/InspectorCollapsible";
import { InspectorSelect } from "~/editor/components/inspector/field/InspectorSelect";
import { NumberField } from "~/editor/components/inspector/field/NumberField";
import { SliderField } from "~/editor/components/inspector/field/SliderField";
import { runGesture } from "~/editor/lib/gesture";
import {
  CAPTION_ARC_MAX,
  CAPTION_ARC_MIN,
  CAPTION_FONT_IDS,
  CAPTION_FONT_LABELS,
  type CaptionFontId,
  type CaptionStyleOverrides,
} from "~/remotion/captions/style";

/** Minimal editable caption overrides (template owns the rest). */
export function CaptionStyleFields({
  overrides,
  resolvedFill,
  resolvedY,
  resolvedFontSize,
  resolvedFontFamily,
  resolvedCaptionsAtATime,
  resolvedArc,
  onPatch,
  defaultOpen = false,
  showCaptionsAtATime = true,
  showArc = false,
  showY = true,
  yMode = "safe-area",
  title = "Style",
}: {
  overrides: CaptionStyleOverrides;
  resolvedFill: string;
  resolvedY: number;
  resolvedFontSize: number;
  resolvedFontFamily: CaptionFontId;
  resolvedCaptionsAtATime?: number;
  resolvedArc?: number;
  onPatch: (partial: CaptionStyleOverrides, live?: boolean) => void;
  defaultOpen?: boolean;
  /** Caption/quote grouping; overlays always show the full phrase. */
  showCaptionsAtATime?: boolean;
  /** Caption curve. */
  showArc?: boolean;
  showY?: boolean;
  /** Captions/quotes: safe-area −1…1. Overlay lines after the first: previous-group height fraction. */
  yMode?: "safe-area" | "line";
  title?: string;
}) {
  const words = resolvedCaptionsAtATime ?? 1;
  const fill = overrides.fill ?? resolvedFill;
  const fillGestureRef = useRef<(() => void) | null>(null);
  const beginFillGesture = () => {
    fillGestureRef.current ??= runGesture();
  };
  const endFillGesture = () => {
    fillGestureRef.current?.();
    fillGestureRef.current = null;
  };

  return (
    <InspectorCollapsible title={title} defaultOpen={defaultOpen}>
      <div
        className={
          showCaptionsAtATime
            ? "grid grid-cols-2 gap-2"
            : "grid grid-cols-1 gap-2"
        }
      >
        <NumberField
          label="Size"
          value={resolvedFontSize}
          step={1}
          min={24}
          max={150}
          onLiveChange={(fontSize) => onPatch({ fontSize }, true)}
        />
        {showCaptionsAtATime ? (
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Words / group
            </Label>
            <div className="flex h-8 items-center overflow-hidden rounded-md border border-border bg-panel-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 rounded-none px-0"
                disabled={words <= 1}
                aria-label="Fewer words per caption"
                onClick={() => onPatch({ captionsAtATime: words - 1 })}
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="min-w-0 flex-1 select-none text-center text-xs text-foreground">
                {words}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 rounded-none px-0"
                disabled={words >= 8}
                aria-label="More words per caption"
                onClick={() => onPatch({ captionsAtATime: words + 1 })}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Font
        </Label>
        <InspectorSelect
          aria-label="Font"
          value={overrides.fontFamily ?? resolvedFontFamily}
          options={CAPTION_FONT_IDS.map((id) => ({
            value: id,
            label: CAPTION_FONT_LABELS[id],
          }))}
          onChange={(fontFamily) =>
            onPatch({ fontFamily: fontFamily as CaptionFontId })
          }
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Fill
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            className="h-8 w-10 cursor-pointer p-1"
            value={fill}
            onFocus={beginFillGesture}
            onBlur={endFillGesture}
            onChange={(e) => onPatch({ fill: e.target.value }, true)}
          />
          <Input
            type="text"
            className="h-8 flex-1"
            value={fill}
            onFocus={beginFillGesture}
            onBlur={endFillGesture}
            onChange={(e) => onPatch({ fill: e.target.value }, true)}
          />
        </div>
      </div>

      {showY ? (
        <SliderField
          label={yMode === "line" ? "Y (gap)" : "Y (safe area)"}
          value={resolvedY}
          min={-1}
          max={1}
          step={0.01}
          display={resolvedY.toFixed(2)}
          onLiveChange={(y) => onPatch({ y }, true)}
          onCommit={(y) => onPatch({ y }, true)}
        />
      ) : null}
      {showArc ? (
        <SliderField
          label="Arc"
          value={resolvedArc ?? 0}
          min={CAPTION_ARC_MIN}
          max={CAPTION_ARC_MAX}
          step={1}
          display={String(resolvedArc ?? 0)}
          onLiveChange={(arc) => onPatch({ arc }, true)}
          onCommit={(arc) => onPatch({ arc }, true)}
        />
      ) : null}
    </InspectorCollapsible>
  );
}
