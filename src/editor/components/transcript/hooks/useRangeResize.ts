import { useEffect, useMemo, useRef } from "react";

import { buildArollLayoutFromAssets } from "~/domain/arolls";
import { clampOverlayMiddle, isTextBaseEdit } from "~/domain/project-config";
import { editMiddleSec } from "~/domain/vfx";
import type { ResizeEdge } from "~/editor/components/transcript/RangeHandle";
import { editsTopologyEqual } from "~/editor/lib/edit-topology";
import { runGesture } from "~/editor/lib/gesture";
import { snapTranscriptCaptionEdge } from "~/editor/lib/snap";
import { wordIndexFromPoint } from "~/editor/lib/use-word-drag-select";
import { useSelection } from "~/editor/selection-store";
import { useEditor, useEditorEqual, useGlobalWords } from "~/editor/store";
import { overlayStackedForEdit } from "~/remotion/templates/overlay";

type ResizeState = {
  edge: ResizeEdge;
  editId: number;
  endGesture: () => void;
};

/**
 * Transcript edit-edge resize: snap to caption/keep edges by default;
 * hold Shift for continuous time within the word under the cursor.
 */
export function useRangeResize() {
  const arolls = useEditor((s) => s.config?.arolls);
  const edits = useEditorEqual((s) => s.config?.edits, editsTopologyEqual);
  const assets = useEditor((s) => s.assets);
  const words = useGlobalWords();
  const clearSelection = useSelection((s) => s.clearSelection);
  const patchEditRange = useEditor((s) => s.patchEditRange);
  const patchEdit = useEditor((s) => s.patchEdit);

  const resizeRef = useRef<ResizeState | null>(null);
  /** Survives mouseup→click so panel click doesn't clear the edit selection. */
  const justResizedRef = useRef(false);

  const keepRanges = useMemo(() => {
    if (!arolls) return [];
    return buildArollLayoutFromAssets(arolls, assets)
      .filter((c) => c.kind === "keep")
      .map((c) => c.timeline);
  }, [arolls, assets]);

  const indexedWords = useMemo(
    () => words.map((w) => ({ ...w, index: w.globalIndex })),
    [words],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;
      const cfg = useEditor.getState().config;
      if (!cfg) return;
      const edit = cfg.edits.find((ed) => ed.id === resize.editId);
      if (!edit) return;

      const hit = wordIndexFromPoint(e.clientX, e.clientY);
      if (hit == null) return;
      const word = useEditor.getState().getGlobalWords()[hit];
      if (!word || word.inGap) return;

      // Listicle split clips to word ends (same as an end handle).
      const edgeForSnap =
        resize.edge === "middle" ? "end" : resize.edge;

      let value: number;
      if (e.shiftKey) {
        const el = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest("[data-word-index]");
        if (el) {
          const rect = el.getBoundingClientRect();
          const t =
            rect.width > 0
              ? Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
              : edgeForSnap === "start"
                ? 0
                : 1;
          value = word.start + (word.end - word.start) * t;
        } else {
          value = edgeForSnap === "start" ? word.start : word.end;
        }
      } else {
        value = snapTranscriptCaptionEdge(
          { start: word.start, end: word.end, index: word.globalIndex },
          edgeForSnap,
          indexedWords,
          keepRanges,
        );
      }

      if (resize.edge === "middle") {
        if (!isTextBaseEdit(edit)) return;
        const current = editMiddleSec(edit, overlayStackedForEdit(edit));
        if (current == null) return;
        const middle = clampOverlayMiddle(edit.start, value, edit.end);
        if (Math.abs(middle - current) < 0.0005) return;
        patchEdit(edit.id, { middle }, true);
        return;
      }

      patchEditRange(edit.id, resize.edge, value);
    };

    const onUp = () => {
      const resize = resizeRef.current;
      if (!resize) return;
      justResizedRef.current = true;
      resize.endGesture();
      resizeRef.current = null;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!resizeRef.current) return;
      resizeRef.current.endGesture();
      resizeRef.current = null;
      justResizedRef.current = false;
      clearSelection();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [
    clearSelection,
    indexedWords,
    keepRanges,
    patchEdit,
    patchEditRange,
  ]);

  const beginResize = (edge: ResizeEdge, editId: number) => {
    if (!edits?.some((e) => e.id === editId)) return;
    useSelection.getState().select("edit", editId);
    resizeRef.current = { edge, editId, endGesture: runGesture() };
  };

  const consumeJustResized = () => {
    if (resizeRef.current || justResizedRef.current) {
      justResizedRef.current = false;
      return true;
    }
    return false;
  };

  return { beginResize, consumeJustResized };
}
