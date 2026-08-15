import { brollSeed } from "~/domain/broll";
import { clampTimelineRangeToMedia } from "~/domain/media";
import { useEditor } from "~/editor/store";
import { useTranscriptUi } from "~/editor/transcript-ui-store";

/** Place the armed B-roll subset on this word. Returns true if consumed. */
export function placePendingBrollOnWord(globalIndex: number): boolean {
  const pending = useTranscriptUi.getState().pendingBrollPlace;
  if (!pending) return false;

  const editor = useEditor.getState();
  const word = editor.getGlobalWords()[globalIndex];
  if (!word || word.inGap) return false;

  const src =
    editor.assets.find((a) => a.id === pending.assetId)?.durationSec ?? null;
  const range = clampTimelineRangeToMedia(
    { start: word.start, end: word.start + pending.durationSec },
    src,
    pending.mediaOffsetSec,
  );
  editor.placeEditOnRange(
    brollSeed(pending.assetId, { mediaOffsetSec: pending.mediaOffsetSec }),
    range,
  );
  editor.seekTimeline(word.start);
  useTranscriptUi.getState().clearPendingBrollPlace();
  return true;
}
