import { maybeSnapTimelineSec } from "~/editor/lib/timeline/snap";
import { useEditor } from "~/editor/store";

/** Captions + keep regions for timeline edge snapping. */
export function useTimelineSnap() {
  return (
    sec: number,
    shiftKey: boolean,
    edge: "start" | "end" = "start",
  ) => {
    const state = useEditor.getState();
    const captions = state
      .getGlobalWords()
      .map((w) => ({ start: w.start, end: w.end }));
    const keeps = state
      .getLayout()
      .filter((c) => c.kind === "keep")
      .map((c) => c.timeline);
    return maybeSnapTimelineSec(sec, captions, shiftKey, edge, keeps);
  };
}
