import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  InspectorCollapsible,
  NumberField,
} from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";
import {
  DEFAULT_EMPHASIS_FILL,
  DEFAULT_EMPHASIS_SCALE,
  EMPHASIS_SCALE_MAX,
  EMPHASIS_SCALE_MIN,
  type EmphasisStyle,
  type QuoteEmphasisStyle,
} from "~/domain/emphasis-style";
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
};

function hexOrDefault(fill: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(fill) ? fill : DEFAULT_EMPHASIS_FILL;
}

function ProjectEmphasisFields({
  value,
  onChange,
}: {
  value: EmphasisStyle;
  onChange: (next: EmphasisStyle, live?: boolean) => void;
}) {
  const scale = value.scale ?? DEFAULT_EMPHASIS_SCALE;
  const fill = value.fill ?? DEFAULT_EMPHASIS_FILL;
  const fontSelectValue = value.fontFamily ?? "inherit";

  return (
    <InspectorCollapsible title="Emphasis" defaultOpen={false}>
      <NumberField
        label="Scale"
        value={scale}
        step={0.05}
        min={EMPHASIS_SCALE_MIN}
        max={EMPHASIS_SCALE_MAX}
        onLiveChange={(nextScale) =>
          onChange({ ...value, scale: nextScale }, true)
        }
      />

      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Fill
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            className="h-8 w-10 cursor-pointer p-1"
            value={hexOrDefault(fill)}
            onFocus={() => useEditor.getState().beginGesture()}
            onChange={(e) => onChange({ ...value, fill: e.target.value }, true)}
          />
          <Input
            type="text"
            className="h-8 flex-1"
            placeholder={DEFAULT_EMPHASIS_FILL}
            value={fill}
            onFocus={() => useEditor.getState().beginGesture()}
            onChange={(e) => onChange({ ...value, fill: e.target.value }, true)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Font
        </Label>
        <select
          className="h-8 w-full rounded-md border border-border bg-panel-2 px-2 text-xs text-foreground"
          value={fontSelectValue}
          onFocus={() => useEditor.getState().beginGesture()}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "inherit") {
              const { fontFamily: _drop, ...rest } = value;
              onChange(rest);
              return;
            }
            onChange({ ...value, fontFamily: v as CaptionFontId });
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

function QuoteEmphasisFields({
  value,
  projectResolved,
  onChange,
}: {
  value: QuoteEmphasisStyle;
  projectResolved: {
    scale: number;
    fill: string;
    fontFamily: CaptionFontId | null;
  };
  onChange: (next: QuoteEmphasisStyle, live?: boolean) => void;
}) {
  const scale = value.scale ?? projectResolved.scale;
  const fillIsInherit = value.fill === null;
  const displayFill = fillIsInherit
    ? ""
    : (value.fill ?? projectResolved.fill);

  const fontSelectValue =
    "fontFamily" in value
      ? value.fontFamily === null
        ? "inherit"
        : (value.fontFamily as string)
      : "project";

  return (
    <InspectorCollapsible title="Emphasis override" defaultOpen={false}>
      <NumberField
        label="Scale"
        value={scale}
        step={0.05}
        min={EMPHASIS_SCALE_MIN}
        max={EMPHASIS_SCALE_MAX}
        onLiveChange={(nextScale) =>
          onChange({ ...value, scale: nextScale }, true)
        }
      />

      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Fill
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            className="h-8 w-10 cursor-pointer p-1"
            disabled={fillIsInherit}
            value={hexOrDefault(
              fillIsInherit ? DEFAULT_EMPHASIS_FILL : displayFill,
            )}
            onFocus={() => useEditor.getState().beginGesture()}
            onChange={(e) => onChange({ ...value, fill: e.target.value }, true)}
          />
          <Input
            type="text"
            className="h-8 flex-1"
            disabled={fillIsInherit}
            placeholder={projectResolved.fill}
            value={fillIsInherit ? "inherit group" : displayFill}
            onFocus={() => useEditor.getState().beginGesture()}
            onChange={(e) => onChange({ ...value, fill: e.target.value }, true)}
          />
        </div>
        <label className="flex items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={fillIsInherit}
            onChange={(e) => {
              useEditor.getState().beginGesture();
              if (e.target.checked) {
                onChange({ ...value, fill: null });
              } else {
                const { fill: _drop, ...rest } = value;
                onChange(rest);
              }
            }}
          />
          Inherit group fill
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Font
        </Label>
        <select
          className="h-8 w-full rounded-md border border-border bg-panel-2 px-2 text-xs text-foreground"
          value={fontSelectValue}
          onFocus={() => useEditor.getState().beginGesture()}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "inherit") {
              onChange({ ...value, fontFamily: null });
              return;
            }
            if (v === "project") {
              const { fontFamily: _drop, ...rest } = value;
              onChange(rest);
              return;
            }
            onChange({ ...value, fontFamily: v as CaptionFontId });
          }}
        >
          <option value="project">Project default</option>
          <option value="inherit">Inherit group</option>
          {CAPTION_FONT_IDS.map((id) => (
            <option key={id} value={id}>
              {FONT_LABELS[id]}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          Inherit group uses the quote font; Project default uses the project
          emphasis font.
        </p>
      </div>
    </InspectorCollapsible>
  );
}

/**
 * Emphasis knobs: scale / fill / font family.
 * No y or words-per-group — those stay on the surrounding caption/quote style.
 */
export function EmphasisStyleFields(
  props:
    | {
        mode: "project";
        value: EmphasisStyle;
        onChange: (next: EmphasisStyle, live?: boolean) => void;
      }
    | {
        mode: "quote";
        value: QuoteEmphasisStyle;
        projectResolved: {
          scale: number;
          fill: string;
          fontFamily: CaptionFontId | null;
        };
        onChange: (next: QuoteEmphasisStyle, live?: boolean) => void;
      },
) {
  if (props.mode === "project") {
    return (
      <ProjectEmphasisFields value={props.value} onChange={props.onChange} />
    );
  }
  return (
    <QuoteEmphasisFields
      value={props.value}
      projectResolved={props.projectResolved}
      onChange={props.onChange}
    />
  );
}
