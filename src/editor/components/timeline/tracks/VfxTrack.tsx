import { clampListicleMiddle, isListicleEdit } from "~/domain/listicle";
import type { VfxEdit } from "~/domain/project-config";
import { Handle, TrackLabel, useTrackDrag } from "~/editor/components/timeline/shared";
import { clampRangeEdge } from "~/editor/lib/range";
import { isSelected } from "~/editor/lib/selection";
import { rangeStyle } from "~/editor/lib/timeline-time";
import { useTimelineSnap } from "~/editor/lib/use-timeline-snap";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";
import {
  DEFAULT_QUOTE_TEMPLATE_ID,
  isQuoteTemplateId,
  resolveQuoteTemplate,
} from "~/remotion/templates/quote";
import { resolveTemplateId } from "~/remotion/templates/style";
import {
  isTextTemplateId,
  TEXT_TEMPLATES,
} from "~/remotion/templates/text";

type Props = {
  edits: VfxEdit[];
  width: number;
};

function vfxCellLabel(edit: VfxEdit): string {
  if (edit.type === "text") {
    const tid = isTextTemplateId(edit.style?.templateId)
      ? edit.style.templateId
      : null;
    const templateLabel = tid ? TEXT_TEMPLATES[tid]?.label : null;
    const text = edit.text.trim();
    if (text) return text;
    return templateLabel ?? "Title";
  }
  if (edit.type === "listicle") {
    const value = edit.valueText.trim();
    const indicator = edit.indicatorText.trim();
    if (value && indicator) return `${indicator} · ${value}`;
    return value || indicator || "Listicle";
  }
  return resolveQuoteTemplate(
    resolveTemplateId(
      edit.style,
      isQuoteTemplateId,
      DEFAULT_QUOTE_TEMPLATE_ID,
    ),
  ).label;
}

export function VfxTrack({ edits, width }: Props) {
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const patchEditRangeById = useEditor((s) => s.patchEditRangeById);
  const patchEdit = useEditor((s) => s.patchEdit);
  const selection = useSelection((s) => s.selection);
  const select = useSelection((s) => s.select);
  const snap = useTimelineSnap();
  const { startDrag } = useTrackDrag();

  if (edits.length === 0) return null;

  return (
    <TrackLabel label="VFX" width={width}>
      {edits.map((edit) => {
        const { left, width: w } = rangeStyle(edit.start, edit.end, pxPerSec);
        const middleLeft =
          isListicleEdit(edit) &&
          edit.middle != null &&
          edit.end > edit.start
            ? (edit.middle - edit.start) * pxPerSec
            : null;
        return (
          <button
            key={edit.id}
            data-cell
            type="button"
            title={`${vfxCellLabel(edit)}  ${edit.start.toFixed(2)}–${edit.end.toFixed(2)}s`}
            className={cn(
              "absolute top-1 bottom-1 flex items-center overflow-hidden rounded bg-vfx px-1.5 text-[10px] text-[#1a1508] select-none",
              isSelected(selection, "edit", edit.id) &&
                "z-[2] outline outline-2 outline-white",
            )}
            style={{ left, width: w }}
            onClick={(e) => {
              e.stopPropagation();
              select("edit", edit.id, e.metaKey || e.ctrlKey);
            }}
          >
            <Handle
              side="left"
              onMouseDown={(e) => {
                select("edit", edit.id);
                const origin = edit.start;
                const fixedEnd = edit.end;
                const id = edit.id;
                startDrag(e, (dxSec, shiftKey) => {
                  const raw = Math.max(0, origin + dxSec);
                  const snapped = snap(raw, shiftKey, "start");
                  const { start, end } = clampRangeEdge("start", snapped, {
                    start: origin,
                    end: fixedEnd,
                  });
                  patchEditRangeById(id, start, end);
                });
              }}
            />
            <span className="truncate">{vfxCellLabel(edit)}</span>
            {middleLeft != null &&
            isListicleEdit(edit) &&
            edit.middle != null ? (
              <span
                role="slider"
                aria-label="Move listicle split"
                className="absolute top-0 bottom-0 z-[3] w-1 -translate-x-1/2 cursor-ew-resize bg-amber-300/90"
                style={{ left: middleLeft }}
                onMouseDown={(e) => {
                  select("edit", edit.id);
                  const origin = edit.middle!;
                  const id = edit.id;
                  const start = edit.start;
                  const end = edit.end;
                  startDrag(e, (dxSec, shiftKey) => {
                    const raw = origin + dxSec;
                    const snapped = snap(raw, shiftKey, "end");
                    const middle = clampListicleMiddle(start, snapped, end);
                    patchEdit(id, { middle }, true);
                  });
                }}
              />
            ) : null}
            <Handle
              side="right"
              onMouseDown={(e) => {
                select("edit", edit.id);
                const origin = edit.end;
                const fixedStart = edit.start;
                const id = edit.id;
                startDrag(e, (dxSec, shiftKey) => {
                  const raw = origin + dxSec;
                  const snapped = snap(raw, shiftKey, "end");
                  const { start, end } = clampRangeEdge("end", snapped, {
                    start: fixedStart,
                    end: origin,
                  });
                  patchEditRangeById(id, start, end);
                });
              }}
            />
          </button>
        );
      })}
    </TrackLabel>
  );
}
