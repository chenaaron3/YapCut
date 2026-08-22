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
  handwritten,
  showCycleFontRoles = false,
}: {
  /** Display values (project, or project←quote merge). */
  value: EmphasisStyle;
  onPatch: (partial: EmphasisStyle, live?: boolean) => void;
  title?: string;
  /** Clear quote override (reset to project). */
  onClear?: () => void;
  /** Theme accent — shown when fill is unset. */
  accent?: string;
  /** Theme handwritten face — shown when font is unset. */
  handwritten: CaptionFontId;
  /** Quote inspector only — cycle theme roles across emphasized words. */
  showCycleFontRoles?: boolean;
}) {
  const scale = value.scale ?? DEFAULT_EMPHASIS_SCALE;
  const fill = value.fill ?? accent;
  const cycleFontRoles = value.cycleFontRoles === true;
  const fontSelectValue = value.fontFamily ?? handwritten;
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

      {showCycleFontRoles ? (
        <label className="text-foreground flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="accent-primary size-3.5"
            checked={cycleFontRoles}
            onChange={(e) =>
              onPatch({ cycleFontRoles: e.target.checked || undefined })
            }
          />
          Cycle fonts
        </label>
      ) : null}

      {cycleFontRoles ? null : (
        <div className="flex flex-col gap-1">
          <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
            Font
          </Label>
          <InspectorSelect
            aria-label="Font"
            value={fontSelectValue}
            options={CAPTION_FONT_IDS.map((id) => ({
              value: id,
              label: CAPTION_FONT_LABELS[id],
            }))}
            onChange={(v) => {
              const fontFamily = v as CaptionFontId;
              onPatch({
                fontFamily: fontFamily === handwritten ? undefined : fontFamily,
              });
            }}
          />
        </div>
      )}
    </InspectorCollapsible>
  );
}
