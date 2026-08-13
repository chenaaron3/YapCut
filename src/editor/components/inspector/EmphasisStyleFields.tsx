import { useRef } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  DEFAULT_EMPHASIS_FILL,
  DEFAULT_EMPHASIS_SCALE,
  EMPHASIS_SCALE_MAX,
  EMPHASIS_SCALE_MIN,
  type EmphasisStyle,
} from "~/domain/emphasis-style";
import {
  InspectorCollapsible,
  NumberField,
} from "~/editor/components/inspector/field";
import { runGesture } from "~/editor/lib/gesture";
import {
  CAPTION_FONT_IDS,
  type CaptionFontId,
} from "~/remotion/captions/style";

const FONT_LABELS: Record<CaptionFontId, string> = {
  montserrat: "Montserrat",
  pacifico: "Pacifico",
  nunito: "Nunito",
  inter: "Inter",
  "proxima-nova": "Proxima Nova",
  poppins: "Poppins",
  caveat: "Caveat",
  "baloo-2": "Baloo 2",
  oswald: "Oswald",
  "playfair-display": "Playfair Display",
  anton: "Anton",
  "homemade-apple": "Homemade Apple",
  "pinyon-script": "Pinyon Script",
  "poiret-one": "Poiret One",
  "great-vibes": "Great Vibes",
  "black-ops-one": "Black Ops One",
  "bootzy-tm": "Bootzy TM",
  "scholar-it": "Scholar Italic",
};

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
}: {
  /** Display values (project, or project←quote merge). */
  value: EmphasisStyle;
  onPatch: (partial: EmphasisStyle, live?: boolean) => void;
  title?: string;
  /** Clear quote override (reset to project). */
  onClear?: () => void;
}) {
  const scale = value.scale ?? DEFAULT_EMPHASIS_SCALE;
  const fill = value.fill ?? DEFAULT_EMPHASIS_FILL;
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
            placeholder={DEFAULT_EMPHASIS_FILL}
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
        <select
          className="border-border bg-panel-2 text-foreground h-8 w-full rounded-md border px-2 text-xs"
          value={fontSelectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "inherit") {
              // Omit font — parent drops the key from the style being edited.
              onPatch({ fontFamily: undefined });
              return;
            }
            onPatch({ fontFamily: v as CaptionFontId });
          }}
        >
          <option value="inherit">Inherit group</option>
          {CAPTION_FONT_IDS.map((id) => (
            <option key={id} value={id}>
              {FONT_LABELS[id]}
            </option>
          ))}
        </select>
      </div>
    </InspectorCollapsible>
  );
}
