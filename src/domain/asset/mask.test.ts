/**
 * Domain checks for Mask type / hard mask.
 * Run: npx tsx src/domain/asset/mask.test.ts
 */
import { hardAlphaFromLuma } from "~/domain/asset/hard-mask";
import {
  arollPlaybackMask,
  parseMaskType,
  maskTypesForRole,
  timelineRangeOverlapsMask,
} from "~/domain/asset/mask";
import { assignKeepIds } from "~/domain/project/project-config";

let failed = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

check("parseMaskType rejects junk", parseMaskType("mask") === null);
check("parseMaskType accepts cutout", parseMaskType("cutout") === "cutout");
check(
  "A-roll mode is Occlude only",
  maskTypesForRole("aroll").join() === "occlude",
);
check(
  "B-roll mode is Cutout only",
  maskTypesForRole("broll").join() === "cutout",
);
check(
  "stored A-roll Cutout paints as Occlude",
  arollPlaybackMask({ type: "cutout", src: "m" })?.type === "occlude",
);
check("Off A-roll paints unmasked", arollPlaybackMask(null) == null);

{
  const data = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
  hardAlphaFromLuma(data);
  check("white luma stays opaque", data[3] === 255);
  check("black luma becomes transparent", data[7] === 0);
}

{
  const arolls = assignKeepIds([{ assetId: "a", start: 0, end: 2 }]);
  const durations = new Map([["a", 5]]);
  const types = new Map<string, "cutout" | "occlude">([["a", "cutout"]]);
  check(
    "legacy Cutout keep still shows Person field",
    timelineRangeOverlapsMask(
      arolls,
      durations,
      types,
      { start: 0.5, end: 1.5 },
    ),
  );
  check(
    "Off keep does not overlap Person field",
    !timelineRangeOverlapsMask(
      arolls,
      durations,
      new Map(),
      { start: 0.5, end: 1.5 },
    ),
  );
  types.set("a", "occlude");
  check(
    "Occlude keep overlaps Person field",
    timelineRangeOverlapsMask(
      arolls,
      durations,
      types,
      { start: 0.5, end: 1.5 },
    ),
  );
}

if (failed > 0) {
  process.exitCode = 1;
  console.error(`${failed} failed`);
} else {
  console.log("all passed");
}
