import { useRef } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  DEFAULT_EMPHASIS_FILL,
  DEFAULT_EMPHASIS_SCALE,
  EMPHASIS_SCALE_MAX,
  EMPHASIS_SCALE_MIN,
} from "~/domain/transcript/emphasis-style";
import { InspectorCollapsible } from "~/editor/components/inspector/field/InspectorCollapsible";
import { InspectorSelect } from "~/editor/components/inspector/field/InspectorSelect";
import { NumberField } from "~/editor/components/inspector/field/NumberField";
import { runGesture } from "~/editor/lib/selection/gesture";
import {
  CAPTION_FONT_IDS,
  CAPTION_FONT_LABELS,
} from "~/remotion/captions/style";

import type { EmphasisStyle } from "~/domain/transcript/emphasis-style";
import type { CaptionFontId } from "~/remotion/captions/style";

function hexOrDefault(fill: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(fill) ? fill : DEFAULT_EMPHASIS_FILL;
}

/**
 * Emphasis knobs: scale / fill / font family.
 * Patches are sparse — parent merges into project or quote emphasis.
 */
export function EmphasisStyleFields({
  value,
  onPatch,
  title = "Emphasis",
  onClear,
  accent = DEFAULT_EMPHASIS_FILL,
}: {
  /** Display values (project, or project←quote merge). */
  value: EmphasisStyle;
  onPatch: (partial: EmphasisStyle, live?: boolean) => void;
  title?: string;
  /** Clear quote override (reset to project). */
  onClear?: () => void;
  /** Theme accent — shown when fill is unset. */
  accent?: string;
}) {
  const scale = value.scale ?? DEFAULT_EMPHASIS_SCALE;
  const fill = value.fill ?? accent;
  const fontSelectValue = value.fontFamily ?? "inherit";
  const fillGestureRef = useRef<(() => void) | null>(null);
  const beginFillGesture = () => {
    fillGestureRef.current ??= runGesture();
  };
  const endFillGesture = () => {
    fillGestureRef.current?.();
    fillGestureRef.current = null;
  };

  return (
    <InspectorCollapsible title={title} defaultOpen={false}>
      {onClear ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-left text-[11px] underline-offset-2 hover:underline"
          onClick={() => onClear()}
        >
          Reset
        </button>
      ) : null}

      <NumberField
        label="Scale"
        value={scale}
        step={0.05}
        min={EMPHASIS_SCALE_MIN}
        max={EMPHASIS_SCALE_MAX}
        onLiveChange={(nextScale) => onPatch({ scale: nextScale }, true)}
      />

      <div className="flex flex-col gap-1">
        <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
          Fill
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            className="h-8 w-10 cursor-pointer p-1"
            value={hexOrDefault(fill)}
            onFocus={beginFillGesture}
            onBlur={endFillGesture}
            onChange={(e) => onPatch({ fill: e.target.value }, true)}
          />
          <Input
            type="text"
            className="h-8 flex-1"
            placeholder={accent}
            value={fill}
            onFocus={beginFillGesture}
            onBlur={endFillGesture}
            onChange={(e) => onPatch({ fill: e.target.value }, true)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
          Font
        </Label>
        <InspectorSelect
          aria-label="Font"
          value={fontSelectValue}
          options={[
            { value: "inherit", label: "Inherit group" },
            ...CAPTION_FONT_IDS.map((id) => ({
              value: id,
              label: CAPTION_FONT_LABELS[id],
            })),
          ]}
          onChange={(v) => {
            if (v === "inherit") {
              // Omit font — parent drops the key from the style being edited.
              onPatch({ fontFamily: undefined });
              return;
            }
            onPatch({ fontFamily: v as CaptionFontId });
          }}
        />
      </div>
    </InspectorCollapsible>
  );
}
