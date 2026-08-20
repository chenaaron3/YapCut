import { useState } from "react";

import { overlayMidpointSec } from "~/domain/project/project-config";
import { OVERLAY_TRANSFORM_DEFAULTS, transformOf } from "~/domain/edit/transform";
import { CaptionStyleFields } from "~/editor/components/inspector/field/CaptionStyleFields";
import { TextField } from "~/editor/components/inspector/field/TextField";
import { TransformFields } from "~/editor/components/inspector/field/TransformFields";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  isOverlayTemplateId,
  OVERLAY_TEMPLATE_LIST,
  resolveOverlayForEdit,
  resolveOverlayTemplate,
} from "~/remotion/templates/overlay";
import { mergeTemplateStyleOverrides } from "~/remotion/templates/style";

import type {
  TemplateStyle,
  VfxListicleEdit,
  VfxTextEdit,
} from "~/domain/project/project-config";
import type { CaptionGroupStyle } from "~/remotion/captions/style";
import type { OverlayTemplateId } from "~/remotion/templates/overlay";

type OverlayEdit = VfxTextEdit | VfxListicleEdit;
type LineTab = "heading" | "subheading";

function persistSerialMiddle(edit: OverlayEdit, stacked: boolean) {
  if (stacked || !edit.subheading.trim() || edit.middle != null) return;
  return { middle: overlayMidpointSec(edit.start, edit.end) };
}

function OverlayLineStyleFields({
  label,
  resolved,
  overrides,
  bag,
  style,
  defaultTemplateId,
  onStyleChange,
}: {
  label: string;
  resolved: CaptionGroupStyle;
  overrides: ReturnType<typeof normalizeCaptionOverrides>;
  bag: "overrides" | "subheadingOverrides";
  style: TemplateStyle | undefined;
  defaultTemplateId: OverlayTemplateId;
  onStyleChange: (next: TemplateStyle, live?: boolean) => void;
}) {
  return (
    <CaptionStyleFields
      title={label}
      defaultOpen
      overrides={overrides}
      resolvedFill={resolved.wordStyle.fill}
      resolvedY={resolved.y}
      resolvedFontSize={resolved.fontSize}
      resolvedFontFamily={resolved.fontFamily}
      showCaptionsAtATime={false}
      showArc
      showY={bag === "subheadingOverrides"}
      yMode="line"
      resolvedArc={resolved.arc ?? 0}
      onPatch={(partial, live) =>
        onStyleChange(
          mergeTemplateStyleOverrides(
            style,
            partial,
            isOverlayTemplateId,
            defaultTemplateId,
            bag,
          ),
          live,
        )
      }
    />
  );
}

export function OverlayVfxFields({
  edit,
  style,
  defaultTemplateId,
  headingLabel,
  subheadingLabel,
  onStyleChange,
}: {
  edit: OverlayEdit;
  style: TemplateStyle | undefined;
  defaultTemplateId: OverlayTemplateId;
  headingLabel: string;
  subheadingLabel: string;
  onStyleChange: (next: TemplateStyle, live?: boolean) => void;
}) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const [lineTab, setLineTab] = useState<LineTab>("heading");
  const look = resolveOverlayForEdit(edit);
  const hasSubheading = Boolean(edit.subheading.trim());
  const activeTab: LineTab =
    hasSubheading && lineTab === "subheading" ? "subheading" : "heading";

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <TextField
        id={`${edit.type}-heading`}
        label={headingLabel}
        value={edit.heading}
        multiline
        onLiveChange={(heading) => patchEdit(edit.id, { heading }, true)}
      />
      <TextField
        id={`${edit.type}-subheading`}
        label={subheadingLabel}
        value={edit.subheading}
        multiline
        onLiveChange={(subheading) => {
          patchEdit(
            edit.id,
            {
              subheading,
              ...(subheading.trim()
                ? persistSerialMiddle({ ...edit, subheading }, look.stacked)
                : { middle: null }),
            },
            true,
          );
        }}
      />

      {hasSubheading && look.stacked ? (
        <label className="text-foreground flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="accent-primary size-3.5"
            checked={edit.middle != null}
            onChange={(e) =>
              patchEdit(edit.id, {
                middle: e.target.checked
                  ? overlayMidpointSec(edit.start, edit.end)
                  : null,
              })
            }
          />
          Stagger reveal
        </label>
      ) : null}

      <label className="text-foreground flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          className="accent-primary size-3.5"
          checked={edit.hideCaptions}
          onChange={(e) =>
            patchEdit(edit.id, { hideCaptions: e.target.checked })
          }
        />
        Hide captions
      </label>

      <StyleTemplatePicker
        templates={OVERLAY_TEMPLATE_LIST.map((t) => ({
          id: t.id,
          label: t.label,
          style: t.headingStyle,
        }))}
        value={look.templateId}
        fallbackStyle={look.heading}
        onChange={(id) => {
          const tid = isOverlayTemplateId(id) ? id : defaultTemplateId;
          onStyleChange({ templateId: tid });
          const patch = persistSerialMiddle(
            edit,
            resolveOverlayTemplate(tid).stacked,
          );
          if (patch) patchEdit(edit.id, patch);
        }}
      />

      {hasSubheading ? (
        <div className="border-border flex gap-1 rounded-md border p-0.5">
          {(["heading", "subheading"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "flex-1 rounded px-2 py-1 text-[10px] font-medium tracking-wide uppercase",
                activeTab === tab
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLineTab(tab)}
            >
              {tab === "heading" ? headingLabel : subheadingLabel}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "heading" ? (
        <OverlayLineStyleFields
          label={hasSubheading ? headingLabel : "Style"}
          resolved={look.heading}
          overrides={normalizeCaptionOverrides(style?.overrides)}
          bag="overrides"
          style={style}
          defaultTemplateId={defaultTemplateId}
          onStyleChange={onStyleChange}
        />
      ) : (
        <OverlayLineStyleFields
          label={subheadingLabel}
          resolved={look.subheading}
          overrides={normalizeCaptionOverrides(style?.subheadingOverrides)}
          bag="subheadingOverrides"
          style={style}
          defaultTemplateId={defaultTemplateId}
          onStyleChange={onStyleChange}
        />
      )}

      <TransformFields
        transform={transformOf(edit)}
        defaults={OVERLAY_TRANSFORM_DEFAULTS}
        onPatch={(partial, live) => patchEdit(edit.id, partial, live)}
      />
    </div>
  );
}
