/**
 * Domain checks for speech-cleanup keep surgery.
 * Run: npx tsx src/domain/speech-cleanup.test.ts
 */
import { buildArollLayout, keepCells } from "~/domain/arolls";
import { isVocalizedPause } from "~/domain/filler";
import { assignKeepIds } from "~/domain/project-config";
import { projectTimelineWords } from "~/domain/projection";
import {
  applyWordIndexCuts,
  normalizeWordIndexCuts,
  vocalizedPauseCuts,
} from "~/domain/speech-cleanup";

import type { GlobalTranscriptWord, TranscriptWord } from "~/domain/transcript";

let failed = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

const assetId = "a";
const durationByAssetId = new Map([[assetId, 10]]);

function localWords(): TranscriptWord[] {
  return [
    { text: "Hello", start: 0.2, end: 0.5 },
    { text: "um", start: 0.55, end: 0.75 },
    { text: "the", start: 0.9, end: 1.1 },
    { text: "three", start: 1.15, end: 1.4 },
    { text: "tricks", start: 1.45, end: 1.8 },
  ];
}

function project(arolls = assignKeepIds([{ assetId, start: 0, end: 2.2 }])) {
  const words = projectTimelineWords(
    arolls,
    new Map([[assetId, localWords()]]),
    durationByAssetId,
  );
  const keepRanges = keepCells(buildArollLayout(arolls, durationByAssetId)).map(
    (cell) => cell.timeline,
  );
  return { arolls, words, keepRanges };
}

function word(globalIndex: number, text: string): GlobalTranscriptWord {
  return {
    text,
    start: globalIndex,
    end: globalIndex + 0.8,
    assetId,
    localIndex: globalIndex,
    globalIndex,
  };
}

check("um is a vocalized pause", isVocalizedPause("Um,"));
check("like is not a vocalized pause", !isVocalizedPause("like"));

{
  const { words } = project();
  const cuts = vocalizedPauseCuts(words);
  check(
    "vocalized sweep finds um",
    cuts.length === 1 && cuts[0]?.startWordIndex === 1,
  );
}

{
  const merged = normalizeWordIndexCuts(
    [
      { startWordIndex: 1, endWordIndex: 1 },
      { startWordIndex: 2, endWordIndex: 3 },
    ],
    [word(0, "a"), word(1, "um"), word(2, "uh"), word(3, "the")],
  );
  check(
    "adjacent index cuts merge",
    merged.length === 1 &&
      merged[0]?.startWordIndex === 1 &&
      merged[0]?.endWordIndex === 3,
  );
}

{
  const { arolls, words, keepRanges } = project();
  const next = applyWordIndexCuts(
    arolls,
    words,
    durationByAssetId,
    [{ startWordIndex: 1, endWordIndex: 1 }],
    keepRanges,
  );
  check("um cut splits into two keeps", next.length === 2);
  check("left keep ends before um", (next[0]?.end ?? 0) <= 0.55 + 0.001);
  check("right keep starts after um", (next[1]?.start ?? 0) >= 0.75 - 0.001);
}

{
  const { arolls, words, keepRanges } = project();
  const next = applyWordIndexCuts(
    arolls,
    words,
    durationByAssetId,
    [{ startWordIndex: 0, endWordIndex: 4 }],
    keepRanges,
  );
  check(
    "refuses cutting almost all speech",
    next.length === arolls.length && next[0]?.end === arolls[0]?.end,
  );
}

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall passed");
