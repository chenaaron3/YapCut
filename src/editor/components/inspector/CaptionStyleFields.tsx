import { Minus, Plus } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  InspectorCollapsible,
  NumberField,
  SliderField,
} from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";
import {
  CAPTION_ARC_MAX,
  CAPTION_ARC_MIN,
  type CaptionStyleOverrides,
} from "~/remotion/captions/style";

/** Minimal editable caption overrides (template owns the rest). */
export function CaptionStyleFields({
  overrides,
  resolvedFill,
  resolvedY,
  resolvedFontSize,
  resolvedCaptionsAtATime,
  resolvedArc,
  onPatch,
  defaultOpen = false,
  showCaptionsAtATime = true,
  showArc = false,
}: {
  overrides: CaptionStyleOverrides;
  resolvedFill: string;
  resolvedY: number;
  resolvedFontSize: number;
  resolvedCaptionsAtATime?: number;
  resolvedArc?: number;
  onPatch: (partial: CaptionStyleOverrides, live?: boolean) => void;
  defaultOpen?: boolean;
  /** Caption/quote grouping; text VFX always show the full phrase. */
  showCaptionsAtATime?: boolean;
  /** StaticGroupView curve (text VFX). */
  showArc?: boolean;
}) {
  const words = resolvedCaptionsAtATime ?? 1;
  const fill = overrides.fill ?? resolvedFill;

  return (
    <InspectorCollapsible title="Style" defaultOpen={defaultOpen}>
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
                onClick={() => {
                  useEditor.getState().beginGesture();
                  onPatch({ captionsAtATime: words - 1 });
                }}
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
                onClick={() => {
                  useEditor.getState().beginGesture();
                  onPatch({ captionsAtATime: words + 1 });
                }}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
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
            onFocus={() => useEditor.getState().beginGesture()}
            onChange={(e) => onPatch({ fill: e.target.value }, true)}
          />
          <Input
            type="text"
            className="h-8 flex-1"
            value={fill}
            onFocus={() => useEditor.getState().beginGesture()}
            onChange={(e) => onPatch({ fill: e.target.value }, true)}
          />
        </div>
      </div>

      <SliderField
        label="Y (safe area)"
        value={resolvedY}
        min={0}
        max={1}
        step={0.01}
        display={resolvedY.toFixed(2)}
        onLiveChange={(y) => onPatch({ y }, true)}
        onCommit={(y) => onPatch({ y }, true)}
      />
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
