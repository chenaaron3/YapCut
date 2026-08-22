import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { isQuoteEdit } from "~/domain/vfx/quote";
import {
  captionOverlayBox,
  safeAreaHeightPx,
} from "~/editor/components/player/caption-overlay";
import {
  boxCss,
  clientToComp,
} from "~/editor/components/player/transform-overlay";
import { TransformHandles } from "~/editor/components/player/TransformHandles";
import { runGesture } from "~/editor/lib/selection/gesture";
import { primaryId } from "~/editor/lib/selection/selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import { clampCaptionY } from "~/remotion/captions/style";
import {
  getCaptionMeasure,
  subscribeCaptionMeasure,
} from "~/remotion/helpers/caption-measure";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";
import { mergeTemplateStyleOverrides } from "~/remotion/templates/style";

import type { CaptionStyleOverrides } from "~/remotion/captions/style";
import type { CaptionMeasure } from "~/remotion/helpers/caption-measure";
import type { PointerEvent as ReactPointerEvent } from "react";

const FONT_SIZE_MIN = 24;
const FONT_SIZE_MAX = 150;

type DragMode =
  | { kind: "move"; startY: number; originY: number }
  | {
      kind: "scale";
      startDist: number;
      originSize: number;
      cx: number;
      cy: number;
    };

function patchCaptionStyle(
  quoteId: number | null,
  partial: CaptionStyleOverrides,
  live: boolean,
) {
  const { config, patchCaptions, patchEdit } = useEditor.getState();
  if (!config) return;
  if (quoteId != null) {
    const edit = config.edits.find((e) => e.id === quoteId);
    if (!edit || !isQuoteEdit(edit)) return;
    patchEdit(
      quoteId,
      {
        style: mergeTemplateStyleOverrides(edit.style, partial),
      },
      live,
    );
    return;
  }
  const overrides = normalizeCaptionOverrides(config.captions.overrides);
  patchCaptions(
    { overrides: normalizeCaptionOverrides({ ...overrides, ...partial }) },
    live,
  );
}

function clampFontSize(n: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(n)));
}

/**
 * Player chrome for spoken captions and quotes — vertical safe-area Y and
 * font-size resize. Writes the same fields as the inspector.
 */
export function CaptionOverlay({
  onDraggingChange,
}: {
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const frame = useEditor((s) => s.frame);
  const groups = useEditor((s) => s.props?.captionGroups);
  const timelineSec = useEditor((s) => s.timelineSec);
  const config = useEditor((s) => s.config);
  const selection = useSelection((s) => s.selection);
  const projectPanel = useSelection((s) => s.projectPanel);
  const setSelection = useSelection((s) => s.setSelection);
  const openCaptionsPanel = useSelection((s) => s.openCaptionsPanel);

  const measure = useSyncExternalStore(
    subscribeCaptionMeasure,
    getCaptionMeasure,
    () => null,
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);
  const endGestureRef = useRef<(() => void) | null>(null);
  const targetQuoteIdRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [visualY, setVisualY] = useState<number | null>(null);
  const [visualScale, setVisualScale] = useState(1);
  const [frozenMeasure, setFrozenMeasure] = useState<CaptionMeasure | null>(
    null,
  );
  const [hovered, setHovered] = useState(false);

  const active = groups?.find(
    (group) => frame >= group.startFrame && frame < group.endFrame,
  );
  const quote = config
    ? (config.edits.find(
        (e) => isQuoteEdit(e) && timelineSec >= e.start && timelineSec < e.end,
      ) ?? null)
    : null;
  const selected = quote
    ? selection?.kind === "edit" && primaryId(selection) === quote.id
    : projectPanel === "captions";

  const y = active?.style?.y ?? 0;
  const fontSize = active?.style?.fontSize ?? 40;
  const paintY = visualY ?? y;

  useEffect(() => {
    onDraggingChange?.(dragging);
  }, [dragging, onDraggingChange]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const root = rootRef.current;
      if (!drag || !root) return;
      const rect = root.getBoundingClientRect();
      const { x, y: py } = clientToComp(e.clientX, e.clientY, rect);

      if (drag.kind === "move") {
        const nextY = clampCaptionY(
          drag.originY + (2 * (py - drag.startY)) / safeAreaHeightPx(),
        );
        setVisualY(nextY);
        patchCaptionStyle(targetQuoteIdRef.current, { y: nextY }, true);
        return;
      }

      const dist = Math.hypot(x - drag.cx, py - drag.cy);
      if (drag.startDist < 1) return;
      const nextSize = clampFontSize(drag.originSize * (dist / drag.startDist));
      setVisualScale(nextSize / drag.originSize);
      patchCaptionStyle(targetQuoteIdRef.current, { fontSize: nextSize }, true);
    };

    const onUp = () => {
      dragRef.current = null;
      setVisualY(null);
      setVisualScale(1);
      setFrozenMeasure(null);
      setDragging(false);
      endGestureRef.current?.();
      endGestureRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  const startDrag = (e: ReactPointerEvent, mode: DragMode["kind"]) => {
    e.preventDefault();
    e.stopPropagation();
    const root = rootRef.current;
    if (!root || !measure) return;
    const rect = root.getBoundingClientRect();
    const { x, y: py } = clientToComp(e.clientX, e.clientY, rect);
    const box = captionOverlayBox(paintY, measure);
    const compCx = (box.leftPct / 100) * COMPOSITION_WIDTH;
    const compCy = (box.topPct / 100) * COMPOSITION_HEIGHT;
    endGestureRef.current?.();
    endGestureRef.current = runGesture();
    targetQuoteIdRef.current = quote?.id ?? null;
    setVisualY(y);
    setVisualScale(1);
    if (mode === "scale") setFrozenMeasure(measure);

    if (mode === "move") {
      dragRef.current = { kind: "move", startY: py, originY: y };
    } else {
      dragRef.current = {
        kind: "scale",
        startDist: Math.max(1, Math.hypot(x - compCx, py - compCy)),
        originSize: fontSize,
        cx: compCx,
        cy: compCy,
      };
    }
    setDragging(true);
  };

  const onHitPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if (!selected) {
      e.preventDefault();
      e.stopPropagation();
      if (quote) setSelection({ kind: "edit", ids: [quote.id] });
      else openCaptionsPanel();
      return;
    }
    startDrag(e, "move");
  };

  if (!active || !measure) return null;

  const box = captionOverlayBox(
    paintY,
    frozenMeasure ?? measure,
    frozenMeasure ? visualScale : 1,
  );

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-[60] overflow-hidden"
    >
      <div
        data-caption-hit=""
        className={`pointer-events-auto absolute ${
          selected
            ? "border-primary/90 group cursor-ns-resize border shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
            : hovered
              ? "border-primary/50 cursor-pointer border shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
              : "cursor-pointer border border-transparent"
        }`}
        style={boxCss(box)}
        onPointerDown={onHitPointerDown}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {selected ? (
          <div
            className={
              dragging
                ? "contents"
                : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
            }
          >
            <TransformHandles
              scale={box.scale}
              onScale={(e) => startDrag(e, "scale")}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
