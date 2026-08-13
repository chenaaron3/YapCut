import { clampOverlayMiddle, isTextBaseEdit } from "~/domain/project-config";
import { editMiddleSec } from "~/domain/vfx";
import {
  Handle,
  TrackLabel,
  useEditEdgeDrag,
  useTrackDrag,
} from "~/editor/components/timeline/shared";
import { rangeStyle } from "~/editor/lib/timeline-time";
import { useIsSelected } from "~/editor/lib/use-is-selected";
import { useTimelineSnap } from "~/editor/lib/use-timeline-snap";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";
import { overlayStackedForEdit } from "~/remotion/templates/overlay";
import {
  DEFAULT_QUOTE_TEMPLATE_ID,
  isQuoteTemplateId,
  resolveQuoteTemplate,
} from "~/remotion/templates/quote";
import { resolveTemplateId } from "~/remotion/templates/style";

import type { TextBaseEdit, VfxEdit } from "~/domain/project-config";

type Props = {
  edits: VfxEdit[];
  width: number;
};

function overlayLabel(edit: TextBaseEdit): string {
  const heading = edit.heading.trim();
  const subheading = edit.subheading.trim();
  if (heading && subheading) return `${heading} · ${subheading}`;
  return (
    heading || subheading || (edit.type === "listicle" ? "Listicle" : "Title")
  );
}

function vfxCellLabel(edit: VfxEdit): string {
  if (edit.type === "text" || edit.type === "listicle")
    return overlayLabel(edit);
  if (edit.type === "shake") return "Shake";
  return resolveQuoteTemplate(
    resolveTemplateId(edit.style, isQuoteTemplateId, DEFAULT_QUOTE_TEMPLATE_ID),
  ).label;
}

export function VfxTrack({ edits, width }: Props) {
  const isSel = useIsSelected(["edit", "arollAsset"]);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const patchEdit = useEditor((s) => s.patchEdit);
  const select = useSelection((s) => s.select);
  const snap = useTimelineSnap();
  const { startDrag } = useTrackDrag();
  const { onEdgeMouseDown } = useEditEdgeDrag();

  if (edits.length === 0) return null;

  return (
    <TrackLabel label="VFX" width={width}>
      {edits.map((edit) => {
        const { left, width: w } = rangeStyle(edit.start, edit.end, pxPerSec);
        const splitMiddle = isTextBaseEdit(edit)
          ? editMiddleSec(edit, overlayStackedForEdit(edit))
          : null;
        const middleLeft =
          splitMiddle != null && edit.end > edit.start
            ? (splitMiddle - edit.start) * pxPerSec
            : null;
        return (
          <button
            key={edit.id}
            data-cell
            type="button"
            title={`${vfxCellLabel(edit)}  ${edit.start.toFixed(2)}–${edit.end.toFixed(2)}s`}
            className={cn(
              "bg-vfx absolute top-1 bottom-1 flex items-center overflow-hidden rounded px-1.5 text-[10px] text-[#1a1508] select-none",
              isSel("edit", edit.id) && "z-[2] outline outline-2 outline-white",
            )}
            style={{ left, width: w }}
            onClick={(e) => {
              e.stopPropagation();
              select("edit", edit.id, e.metaKey || e.ctrlKey);
            }}
          >
            <Handle
              side="left"
              onMouseDown={(e) => onEdgeMouseDown(e, edit, "start")}
            />
            <span className="truncate">{vfxCellLabel(edit)}</span>
            {middleLeft != null && splitMiddle != null ? (
              <span
                role="slider"
                aria-label="Move split"
                aria-valuenow={splitMiddle}
                aria-valuemin={edit.start}
                aria-valuemax={edit.end}
                aria-orientation="horizontal"
                className="absolute top-0 bottom-0 z-[3] w-1 -translate-x-1/2 cursor-ew-resize bg-amber-300/90"
                style={{ left: middleLeft }}
                onMouseDown={(e) => {
                  select("edit", edit.id);
                  const origin = splitMiddle;
                  const id = edit.id;
                  const start = edit.start;
                  const end = edit.end;
                  startDrag(e, (dxSec, shiftKey) => {
                    const raw = origin + dxSec;
                    const snapped = snap(raw, shiftKey, "end");
                    const middle = clampOverlayMiddle(start, snapped, end);
                    patchEdit(id, { middle }, true);
                  });
                }}
              />
            ) : null}
            <Handle
              side="right"
              onMouseDown={(e) => onEdgeMouseDown(e, edit, "end")}
            />
          </button>
        );
      })}
    </TrackLabel>
  );
}
