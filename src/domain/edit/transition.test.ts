/**
 * Domain checks for A-roll transitions.
 * Run: npx tsx src/domain/edit/transition.test.ts
 */
import {
  buildArollLayout,
  deleteTimelineRange,
  keepCells,
  restoreGap,
  setArollKeepEdge,
} from "~/domain/aroll/arolls";
import {
  emptyProjectConfig,
  nextKeepId,
  assignKeepIds,
  type Edit,
  type ProjectConfig,
} from "~/domain/project/project-config";
import {
  applyKeepRewrites,
  interiorStitchesWithoutTransition,
  isTransitionEdit,
  isValidTransitionDropWord,
  stitchFromPlaceHint,
  maxTransitionDuration,
  placeTransitionAtStitch,
  rangeForStitch,
  reconcileTransitions,
  resizeTransitionFromEdge,
  seedListicleTransitions,
  seedOpeningClosingPair,
  stitchKey,
  transitionDropForWord,
  transitionOutputDuration,
  type TransitionEdit,
  type TransitionStitch,
} from "~/domain/edit/transition";
import type { GlobalTranscriptWord } from "~/domain/transcript/transcript";

let failed = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function approx(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) < eps;
}

function word(
  partial: Omit<GlobalTranscriptWord, "emphasized"> & { inGap?: boolean },
): GlobalTranscriptWord {
  return { ...partial };
}

const assetId = "a";
const arolls = assignKeepIds([
  { assetId, start: 0, end: 5 },
  { assetId, start: 8, end: 13 },
]);
const durations = new Map([[assetId, 20]]);
const layout = buildArollLayout(arolls, durations);
const keeps = keepCells(layout);
const keepA = keeps[0]!;
const keepB = keeps[1]!;
const interiorStitch: TransitionStitch = {
  kind: "interior",
  outKeepId: keepA.id,
  inKeepId: keepB.id,
};
const openingStitch: TransitionStitch = { kind: "opening" };
const closingStitch: TransitionStitch = { kind: "closing" };

check("layout has two keeps and a gap", keeps.length === 2);
check(
  "gap sits between keeps",
  approx(keeps[0]!.timeline.end, 5) && approx(keeps[1]!.timeline.start, 8),
);
check("keep cells use persisted keep ids", keepA.id === 1 && keepB.id === 2);

const opening = rangeForStitch(openingStitch, 0.12, layout);
check("opening is in-only on first keep", opening != null);
check(
  "opening left edge pinned to first keep start",
  opening != null && approx(opening.start, keeps[0]!.timeline.start),
);
check(
  "opening stays inside first keep",
  opening != null && opening.end < keeps[0]!.timeline.end - 0.001,
);

const closing = rangeForStitch(closingStitch, 0.12, layout);
check("closing is out-only on last keep", closing != null);
check(
  "closing right edge pinned to last keep end",
  closing != null && approx(closing.end, keeps[1]!.timeline.end),
);
check(
  "closing stays inside last keep",
  closing != null && closing.start > keeps[1]!.timeline.start + 0.001,
);

const interior = rangeForStitch(interiorStitch, 0.12, layout);
check("interior bridges the gap", interior != null);
check(
  "interior start is in keep 0",
  interior != null &&
    interior.start < keeps[0]!.timeline.end &&
    interior.start >= keeps[0]!.timeline.start,
);
check(
  "interior end is in keep 1",
  interior != null &&
    interior.end > keeps[1]!.timeline.start &&
    interior.end <= keeps[1]!.timeline.end,
);
check(
  "interior timeline span includes the gap",
  interior != null && interior.end - interior.start > 3,
);

const placedInterior = placeTransitionAtStitch(
  [],
  interiorStitch,
  "flash",
  layout,
  0.12,
);
check("place interior persists stitch + durationSec", placedInterior.length === 1);
check(
  "placed durationSec is output overlap not gap length",
  placedInterior[0] != null &&
    isTransitionEdit(placedInterior[0]) &&
    approx(transitionOutputDuration(placedInterior[0]), 0.12),
);

check(
  "mid-keep place hint is rejected",
  stitchFromPlaceHint(2.0, layout) == null,
);

const resized = resizeTransitionFromEdge(
  placedInterior[0] as TransitionEdit,
  "start",
  keeps[0]!.timeline.end - 0.2,
  layout,
);
check("symmetric resize returns an edit", resized != null);
check(
  "symmetric resize grows both keeps equally",
  resized != null && approx(transitionOutputDuration(resized), 0.4, 0.05),
);

const grown = rangeForStitch(interiorStitch, 1.0, layout);
check(
  "growing does not eat the gap",
  grown != null &&
    grown.start < keeps[0]!.timeline.end - 0.01 &&
    grown.end > keeps[1]!.timeline.start + 0.01 &&
    grown.end - grown.start > 3,
);

const words: GlobalTranscriptWord[] = [
  word({
    text: "Hello.",
    start: 0,
    end: 0.4,
    assetId,
    localIndex: 0,
    globalIndex: 0,
  }),
  word({
    text: "World",
    start: 0.5,
    end: 0.9,
    assetId,
    localIndex: 1,
    globalIndex: 1,
  }),
  word({
    text: "deleted.",
    start: 5.2,
    end: 5.6,
    assetId,
    localIndex: 2,
    globalIndex: 2,
    inGap: true,
  }),
  word({
    text: "Next",
    start: 8.0,
    end: 8.3,
    assetId,
    localIndex: 3,
    globalIndex: 3,
  }),
  word({
    text: "sentence.",
    start: 8.4,
    end: 8.9,
    assetId,
    localIndex: 4,
    globalIndex: 4,
  }),
];

const midKeepWords: GlobalTranscriptWord[] = [
  word({
    text: "Hello.",
    start: 0,
    end: 0.4,
    assetId,
    localIndex: 0,
    globalIndex: 0,
  }),
  word({
    text: "World",
    start: 1.0,
    end: 1.4,
    assetId,
    localIndex: 1,
    globalIndex: 1,
  }),
  word({
    text: "continues",
    start: 1.5,
    end: 1.9,
    assetId,
    localIndex: 2,
    globalIndex: 2,
  }),
];

check(
  "opening first word is a valid drop",
  isValidTransitionDropWord(0, words, layout),
);
check(
  "mid-keep Hello. World with no cut is not a drop",
  !isValidTransitionDropWord(1, midKeepWords, layout),
);
check(
  "keep-edge punctuated sentence is a drop",
  isValidTransitionDropWord(3, words, layout),
);
check(
  "last kept word is a closing drop",
  transitionDropForWord(4, words, layout)?.stitch.kind === "closing",
);
check(
  "in-gap word is not a drop",
  !isValidTransitionDropWord(2, words, layout),
);

const seeded = seedOpeningClosingPair([], layout, "flash");
const seededKinds = seeded
  .filter(isTransitionEdit)
  .map((e) => e.stitch.kind);
check(
  "seed opening+closing flash pair",
  seededKinds.includes("opening") && seededKinds.includes("closing"),
);
check(
  "seeded pair shares duration",
  (() => {
    const pair = seeded.filter(isTransitionEdit);
    if (pair.length < 2) return false;
    return approx(
      transitionOutputDuration(pair[0]!),
      transitionOutputDuration(pair[1]!),
    );
  })(),
);

const listicle: Edit = {
  id: 10,
  kind: "vfx",
  type: "listicle",
  start: 8.0,
  end: 10,
  heading: "Tip #1",
  subheading: "Go",
  middle: 8.5,
  hideCaptions: true,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  style: { templateId: "red-teal" },
};
const withListicle = seedListicleTransitions([listicle], words, layout);
check(
  "listicle on valid drop word seeds a transition",
  withListicle.some((e) => e.kind === "transition"),
);

const midListicle: Edit = {
  ...listicle,
  id: 11,
  start: 1.0,
  end: 2.0,
};
const midListicleEdits = seedListicleTransitions(
  [midListicle],
  midKeepWords,
  layout,
);
check(
  "mid-keep listicle does not seed a transition",
  midListicleEdits.every((e) => e.kind !== "transition"),
);

const remaining = interiorStitchesWithoutTransition(
  withListicle,
  words,
  layout,
);
check(
  "filled listicle junction is not an LLM candidate",
  remaining.every(
    (j) => j.kind !== "interior" || j.inKeepId !== keepB.id,
  ),
);

const maxD = maxTransitionDuration(interiorStitch, layout);
check("max interior duration is finite and >= default", maxD >= 0.12);

const cfg = emptyProjectConfig();
check("empty config has no edits", cfg.edits.length === 0);

const replaced = placeTransitionAtStitch(
  placedInterior,
  interiorStitch,
  "slide",
  layout,
);
check(
  "explicit replace-not-stack keeps one edit",
  replaced.filter((e) => e.kind === "transition").length === 1,
);
check(
  "explicit replace updates template",
  replaced.some((e) => e.kind === "transition" && e.templateId === "slide"),
);

// --- keep-id rewrite (split / merge / remove) ---

const tAb: TransitionEdit = {
  id: 1,
  kind: "transition",
  templateId: "flash",
  durationSec: 0.12,
  stitch: { kind: "interior", outKeepId: 1, inKeepId: 2 },
  start: 0,
  end: 1,
};
const tBc: TransitionEdit = {
  id: 2,
  kind: "transition",
  templateId: "flash",
  durationSec: 0.12,
  stitch: { kind: "interior", outKeepId: 2, inKeepId: 3 },
  start: 0,
  end: 1,
};

function interiorOf(
  edits: readonly Edit[],
  id: number,
): Extract<TransitionStitch, { kind: "interior" }> | null {
  const e = edits.find((x) => x.id === id);
  if (!e || !isTransitionEdit(e) || e.stitch.kind !== "interior") return null;
  return e.stitch;
}

const splitA = applyKeepRewrites([tAb, tBc], [
  { type: "split", id: 1, rightId: 11 },
]);
check(
  "split A remaps T_AB out to A'",
  interiorOf(splitA, 1)?.outKeepId === 11 &&
    interiorOf(splitA, 1)?.inKeepId === 2,
);
check("split A leaves T_BC unchanged", stitchKey(interiorOf(splitA, 2)!) === "interior:2:3");

const splitB = applyKeepRewrites([tAb, tBc], [
  { type: "split", id: 2, rightId: 12 },
]);
check(
  "split B leaves T_AB on left B",
  stitchKey(interiorOf(splitB, 1)!) === "interior:1:2",
);
check(
  "split B remaps T_BC out to B'",
  interiorOf(splitB, 2)?.outKeepId === 12 &&
    interiorOf(splitB, 2)?.inKeepId === 3,
);

const splitC = applyKeepRewrites([tAb, tBc], [
  { type: "split", id: 3, rightId: 13 },
]);
check("split C leaves both interiors unchanged", splitC.length === 2);
check(
  "split C does not remap T_BC",
  stitchKey(interiorOf(splitC, 2)!) === "interior:2:3",
);

const mergeAb = applyKeepRewrites(
  [{ ...tAb, stitch: { kind: "interior", outKeepId: 2, inKeepId: 3 } }],
  [{ type: "merge", dyingId: 2, survivorId: 1 }],
);
check(
  "merge A+B remaps T_BC out B→A",
  interiorOf(mergeAb, 1)?.outKeepId === 1 &&
    interiorOf(mergeAb, 1)?.inKeepId === 3,
);

const mergeCd = applyKeepRewrites(
  [{ ...tAb, stitch: { kind: "interior", outKeepId: 2, inKeepId: 3 } }],
  [{ type: "merge", dyingId: 4, survivorId: 3 }],
);
check(
  "merge C+D leaves T_BC (C stable)",
  stitchKey(interiorOf(mergeCd, 1)!) === "interior:2:3",
);

const mergeBc = applyKeepRewrites([tAb, tBc], [
  { type: "merge", dyingId: 3, survivorId: 2 },
]);
check("merge B+C drops T_BC (self-stitch)", !mergeBc.some((e) => e.id === 2));
check(
  "merge B+C keeps T_AB",
  stitchKey(interiorOf(mergeBc, 1)!) === "interior:1:2",
);

const removed = applyKeepRewrites([tAb, tBc], [{ type: "remove", id: 2 }]);
check("remove B drops both stitches that named B", removed.length === 0);

// --- e2e via A-roll surgery ---

function abcProject(): ProjectConfig {
  const keepsAbc = assignKeepIds([
    { assetId, start: 0, end: 5 },
    { assetId, start: 8, end: 13 },
    { assetId, start: 16, end: 21 },
  ]);
  const lay = buildArollLayout(keepsAbc, new Map([[assetId, 30]]));
  let next: Edit[] = [];
  next = placeTransitionAtStitch(
    next,
    { kind: "interior", outKeepId: keepsAbc[0]!.id, inKeepId: keepsAbc[1]!.id },
    "flash",
    lay,
  );
  next = placeTransitionAtStitch(
    next,
    { kind: "interior", outKeepId: keepsAbc[1]!.id, inKeepId: keepsAbc[2]!.id },
    "slide",
    lay,
  );
  next = placeTransitionAtStitch(next, openingStitch, "flash", lay);
  next = placeTransitionAtStitch(next, closingStitch, "flash", lay);
  return { ...emptyProjectConfig(), arolls: keepsAbc, edits: next };
}

function interiors(config: ProjectConfig) {
  return config.edits.filter(
    (
      e,
    ): e is TransitionEdit & {
      stitch: Extract<TransitionStitch, { kind: "interior" }>;
    } => isTransitionEdit(e) && e.stitch.kind === "interior",
  );
}

const durAbc = new Map([[assetId, 30]]);

const splitBCfg = deleteTimelineRange(
  abcProject(),
  { start: 10, end: 11 },
  durAbc,
);
check(
  "split B via hole keeps two interiors",
  interiors(splitBCfg).length === 2,
);
check(
  "split B: T_AB still on original B id",
  interiors(splitBCfg).some(
    (e) =>
      e.stitch.kind === "interior" &&
      e.stitch.outKeepId === 1 &&
      e.stitch.inKeepId === 2,
  ),
);
check(
  "split B: T_BC out moved to new right keep",
  interiors(splitBCfg).some(
    (e) =>
      e.stitch.kind === "interior" &&
      e.stitch.outKeepId !== 2 &&
      e.stitch.inKeepId === 3,
  ),
);
check(
  "split B: opening+closing survive",
  splitBCfg.edits.filter(isTransitionEdit).some((e) => e.stitch.kind === "opening") &&
    splitBCfg.edits.filter(isTransitionEdit).some((e) => e.stitch.kind === "closing"),
);

const splitACfg = deleteTimelineRange(
  abcProject(),
  { start: 2, end: 3 },
  durAbc,
);
check(
  "split A remaps T_AB out to A' and keeps T_BC",
  interiors(splitACfg).length === 2 &&
    interiors(splitACfg).some(
      (e) =>
        e.stitch.kind === "interior" &&
        e.stitch.outKeepId !== 1 &&
        e.stitch.inKeepId === 2,
    ) &&
    interiors(splitACfg).some(
      (e) =>
        e.stitch.kind === "interior" &&
        e.stitch.outKeepId === 2 &&
        e.stitch.inKeepId === 3,
    ),
);

const splitCCfg = deleteTimelineRange(
  abcProject(),
  { start: 18, end: 19 },
  durAbc,
);
check(
  "split C leaves both interiors on original keep ids",
  interiors(splitCCfg).length === 2 &&
    interiors(splitCCfg).some(
      (e) =>
        e.stitch.kind === "interior" &&
        e.stitch.outKeepId === 1 &&
        e.stitch.inKeepId === 2,
    ) &&
    interiors(splitCCfg).some(
      (e) =>
        e.stitch.kind === "interior" &&
        e.stitch.outKeepId === 2 &&
        e.stitch.inKeepId === 3,
    ),
);

const trimB = setArollKeepEdge(abcProject(), 1, "start", 9, durAbc);
check(
  "trimming keep B range does not drop interiors",
  interiors(trimB).length === 2,
);
check(
  "trimming keep B does not drop opening/closing",
  trimB.edits.filter(isTransitionEdit).length === 4,
);

const baseAbc = abcProject();
const spliced = [
  ...baseAbc.arolls.slice(0, 1),
  {
    id: nextKeepId(baseAbc.arolls),
    assetId: "x",
    start: 0,
    end: 1,
  },
  ...baseAbc.arolls.slice(1),
];
const insertBetweenEdits = reconcileTransitions(
  baseAbc.edits,
  buildArollLayout(spliced, new Map([[assetId, 30], ["x", 1]])),
);
check(
  "keep inserted between A and B drops T_AB (no longer adjacent)",
  !insertBetweenEdits.some(
    (e) =>
      isTransitionEdit(e) &&
      e.stitch.kind === "interior" &&
      e.stitch.outKeepId === 1 &&
      e.stitch.inKeepId === 2,
  ),
);
check(
  "keep inserted between A and B keeps T_BC",
  insertBetweenEdits.some(
    (e) =>
      isTransitionEdit(e) &&
      e.stitch.kind === "interior" &&
      e.stitch.outKeepId === 2 &&
      e.stitch.inKeepId === 3,
  ),
);

const mergeAbCfg = restoreGap(
  abcProject(),
  { assetId, start: 5, end: 8 },
  durAbc,
);
check(
  "restore gap A–B merges into A and remaps T_BC onto A→C",
  interiors(mergeAbCfg).length === 1 &&
    interiors(mergeAbCfg)[0]!.stitch.kind === "interior" &&
    interiors(mergeAbCfg)[0]!.stitch.outKeepId === 1 &&
    interiors(mergeAbCfg)[0]!.stitch.inKeepId === 3,
);

const fourKeeps = assignKeepIds([
  { assetId, start: 0, end: 3 },
  { assetId, start: 5, end: 8 },
  { assetId, start: 10, end: 13 },
  { assetId, start: 15, end: 18 },
]);
const fourLayout = buildArollLayout(fourKeeps, new Map([[assetId, 25]]));
const tBcOnly = placeTransitionAtStitch(
  [],
  {
    kind: "interior",
    outKeepId: fourKeeps[1]!.id,
    inKeepId: fourKeeps[2]!.id,
  },
  "flash",
  fourLayout,
);
const fourCfg: ProjectConfig = {
  ...emptyProjectConfig(),
  arolls: fourKeeps,
  edits: tBcOnly,
};
const durFour = new Map([[assetId, 25]]);

const mergeAbFour = restoreGap(
  fourCfg,
  { assetId, start: 3, end: 5 },
  durFour,
);
check(
  "A+B merge remaps T_BC onto A→C",
  interiors(mergeAbFour).length === 1 &&
    interiors(mergeAbFour)[0]!.stitch.kind === "interior" &&
    interiors(mergeAbFour)[0]!.stitch.outKeepId === fourKeeps[0]!.id &&
    interiors(mergeAbFour)[0]!.stitch.inKeepId === fourKeeps[2]!.id,
);

const mergeCdFour = restoreGap(
  fourCfg,
  { assetId, start: 13, end: 15 },
  durFour,
);
check(
  "C+D merge leaves T_BC (C stable)",
  interiors(mergeCdFour).length === 1 &&
    interiors(mergeCdFour)[0]!.stitch.kind === "interior" &&
    interiors(mergeCdFour)[0]!.stitch.outKeepId === fourKeeps[1]!.id &&
    interiors(mergeCdFour)[0]!.stitch.inKeepId === fourKeeps[2]!.id,
);

const mergeBcFour = restoreGap(
  fourCfg,
  { assetId, start: 8, end: 10 },
  durFour,
);
check(
  "B+C merge deletes T_BC",
  interiors(mergeBcFour).length === 0,
);

const deleteB = deleteTimelineRange(
  abcProject(),
  { start: 8, end: 13 },
  durAbc,
);
check(
  "deleting keep B drops both interiors that named it",
  interiors(deleteB).length === 0,
);
check(
  "deleting keep B keeps opening+closing roles",
  deleteB.edits.filter(isTransitionEdit).some((e) => e.stitch.kind === "opening") &&
    deleteB.edits.filter(isTransitionEdit).some((e) => e.stitch.kind === "closing"),
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall transition domain checks passed");
