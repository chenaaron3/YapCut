import { buildArollLayout } from "~/domain/aroll/arolls";
import { scribbleWordFields } from "~/domain/transcript/scribble";

import type { ArollLayoutCell } from "~/domain/aroll/arolls";
import type { ArollKeep } from "~/domain/project/project-config";
import type { GlobalTranscriptWord, TranscriptWord } from "~/domain/transcript/transcript";

/**
 * Project local asset words onto the expanded timeline (gaps count).
 * Words overlapping keep or gap cells are shown (gap words marked `inGap`).
 * Output/export captions still use `projectOutputWords` (keeps only).
 */
export function projectTimelineWords(
  arolls: readonly ArollKeep[],
  transcriptsByAssetId: ReadonlyMap<string, readonly TranscriptWord[]>,
  assetDurationSec: ReadonlyMap<string, number>,
): GlobalTranscriptWord[] {
  const layout = buildArollLayout(arolls, assetDurationSec);
  return projectTimelineWordsFromLayout(layout, transcriptsByAssetId);
}

export function projectTimelineWordsFromLayout(
  layout: readonly ArollLayoutCell[],
  transcriptsByAssetId: ReadonlyMap<string, readonly TranscriptWord[]>,
): GlobalTranscriptWord[] {
  const result: GlobalTranscriptWord[] = [];
  let globalIndex = 0;

  for (const cell of layout) {
    const words = transcriptsByAssetId.get(cell.local.assetId) ?? [];

    for (let localIndex = 0; localIndex < words.length; localIndex++) {
      const word = words[localIndex]!;
      if (
        word.end <= cell.local.start + 0.001 ||
        word.start >= cell.local.end - 0.001
      ) {
        continue;
      }

      const localStart = Math.max(word.start, cell.local.start);
      const localEnd = Math.min(word.end, cell.local.end);
      if (localEnd <= localStart) continue;

      result.push({
        text: word.text,
        start: cell.timeline.start + (localStart - cell.local.start),
        end: cell.timeline.start + (localEnd - cell.local.start),
        ...scribbleWordFields(word),
        assetId: cell.local.assetId,
        localIndex,
        globalIndex,
        ...(cell.kind === "gap" ? { inGap: true } : {}),
      });
      globalIndex += 1;
    }
  }

  return result;
}

/**
 * Compacted output-word projection (keeps only — for Remotion captions).
 */
export function projectOutputWords(
  arolls: readonly ArollKeep[],
  transcriptsByAssetId: ReadonlyMap<string, readonly TranscriptWord[]>,
): GlobalTranscriptWord[] {
  const result: GlobalTranscriptWord[] = [];
  let outputCursor = 0;
  let globalIndex = 0;

  for (const keep of arolls) {
    const words = transcriptsByAssetId.get(keep.assetId) ?? [];
    const keepDuration = Math.max(0, keep.end - keep.start);

    for (let localIndex = 0; localIndex < words.length; localIndex++) {
      const word = words[localIndex]!;
      if (word.end <= keep.start + 0.001 || word.start >= keep.end - 0.001) {
        continue;
      }

      const localStart = Math.max(word.start, keep.start);
      const localEnd = Math.min(word.end, keep.end);
      if (localEnd <= localStart) continue;

      result.push({
        text: word.text,
        start: outputCursor + (localStart - keep.start),
        end: outputCursor + (localEnd - keep.start),
        ...scribbleWordFields(word),
        assetId: keep.assetId,
        localIndex,
        globalIndex,
      });
      globalIndex += 1;
    }

    outputCursor += keepDuration;
  }

  return result;
}

/** Spoken words only, reindexed so `globalIndex` matches array order. */
export function keptTimelineWords(
  words: readonly GlobalTranscriptWord[],
): GlobalTranscriptWord[] {
  return words
    .filter((w) => !w.inGap)
    .map((w, globalIndex) => ({ ...w, globalIndex }));
}

/** Numbered transcript lines for OpenAI prompts that return word indices. */
export function buildNumberedTranscript(
  words: readonly { text: string }[],
): string {
  return words.map((w, i) => `${i}: ${w.text}`).join("\n");
}

export function wordIndexToTimelineSec(
  index: number,
  words: readonly GlobalTranscriptWord[],
  prefer: "start" | "end",
): number | null {
  if (index < 0 || index >= words.length) return null;
  const word = words[index]!;
  return prefer === "start" ? word.start : word.end;
}

/** Global word index under the expanded timeline playhead, if any. */
export function wordIndexAtTimelineSec(
  timelineSec: number,
  words: readonly GlobalTranscriptWord[],
): number | null {
  for (const word of words) {
    if (timelineSec >= word.start && timelineSec < word.end) {
      return word.globalIndex;
    }
  }
  return null;
}

/** Next kept (not cut-out / `inGap`) word index in `direction`, or null. */
export function adjacentKeptWordIndex(
  fromIndex: number,
  direction: -1 | 1,
  words: readonly GlobalTranscriptWord[],
): number | null {
  let i = fromIndex + direction;
  while (i >= 0 && i < words.length) {
    if (!words[i]!.inGap) return i;
    i += direction;
  }
  return null;
}
