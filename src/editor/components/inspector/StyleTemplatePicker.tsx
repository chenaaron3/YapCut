import { useState } from "react";

import {
  CaptionTemplatePreview,
  type ListiclePreviewPair,
} from "~/editor/components/inspector/CaptionTemplatePreview";
import { requestPlayAfterSeek } from "~/editor/lib/player-bridge";
import { useEditor } from "~/editor/store";
import {
  resolveCaptionFont,
  type CaptionGroupStyle,
} from "~/remotion/captions/style";
import { cn } from "~/lib/utils";

export type StyleTemplateChip = {
  id: string;
  label: string;
  style: CaptionGroupStyle;
  /** Optional dual-layer preview (listicle indicator + value). */
  previewPair?: ListiclePreviewPair;
};

function resolvePreviewPair(
  chip: StyleTemplateChip | null | undefined,
  fallback?: ListiclePreviewPair | null,
): ListiclePreviewPair | null {
  return chip?.previewPair ?? fallback ?? null;
}

/** Shared template preview + chip picker for Captions, Quote, and Title inspectors. */
export function StyleTemplatePicker({
  templates,
  value,
  onChange,
  /** When set, used as the idle preview (e.g. live project style). */
  fallbackStyle,
  /** Idle dual-layer preview (listicle). */
  fallbackPair,
  previewVariant = "dynamic",
}: {
  templates: StyleTemplateChip[];
  value: string | null;
  onChange: (id: string) => void;
  fallbackStyle?: CaptionGroupStyle;
  fallbackPair?: ListiclePreviewPair | null;
  previewVariant?: "dynamic" | "static";
}) {
  const [hovered, setHovered] = useState<StyleTemplateChip | null>(null);
  const selected = templates.find((t) => t.id === value) ?? null;
  const previewingOther =
    hovered != null && value != null && hovered.id !== value;
  const previewStyle = previewingOther
    ? hovered.style
    : (fallbackStyle ?? selected?.style ?? null);
  const previewPair = previewingOther
    ? resolvePreviewPair(hovered)
    : resolvePreviewPair(selected, fallbackPair);
  const previewLabel = previewingOther ? hovered.label : (selected?.label ?? null);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-1.5">
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        Template
      </span>

      <div className="overflow-hidden rounded-lg border border-border">
        {previewStyle ? (
          <>
            <CaptionTemplatePreview
              style={previewStyle}
              playing={previewingOther}
              variant={previewVariant}
              pair={previewPair}
              restartKey={
                previewingOther
                  ? hovered.id
                  : (selected?.id ?? value ?? "")
              }
            />
            <div className="border-t border-border bg-panel-2 px-2 py-1.5 text-center text-[10px] text-muted-foreground">
              {previewLabel ?? "Current"}
              {previewingOther ? (
                <span className="text-muted-foreground/70"> · preview</span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex h-[128px] items-center justify-center bg-panel-2 text-[11px] text-muted-foreground">
            Hover a template
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap gap-2">
        {templates.map((template) => {
          const selectedChip = template.id === value;
          const face = resolveCaptionFont(template.style.fontFamily);
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                if (template.id === value) return;
                useEditor.getState().beginGesture();
                setHovered(null);
                requestPlayAfterSeek();
                onChange(template.id);
              }}
              onMouseEnter={() => setHovered(template)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(template)}
              onBlur={() => setHovered(null)}
              className={cn(
                "flex h-14 w-24 shrink-0 flex-col items-center justify-center rounded-lg border px-2 text-center transition-colors",
                selectedChip
                  ? "border-primary bg-primary/15"
                  : "border-border bg-panel-2 hover:bg-panel-2/80",
              )}
              title={template.label}
            >
              <span
                className="max-w-full truncate text-[11px] leading-tight"
                style={{
                  color: template.style.wordStyle.fill,
                  fontFamily: face.family,
                  fontWeight: face.weight,
                }}
              >
                Aa
              </span>
              <span className="mt-1 max-w-full truncate text-[9px] text-muted-foreground">
                {template.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
