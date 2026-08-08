import {
  Film,
  Quote,
  Type,
  Volume2,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";

import type { Edit } from "~/domain/project-config";

/**
 * View chrome identity for an Edit kind (or vfx subtype).
 * Add a new edit type by registering a spec — WordCell / annotations stay generic.
 * Array order = primary-underline rank (earlier wins when idle).
 */
export type EditChromeKey =
  | "zoom"
  | "vfx:text"
  | "vfx:quote"
  | "broll"
  | "sfx";

export type EditChromeSpec = {
  key: EditChromeKey;
  label: string;
  Icon: LucideIcon;
  markerClass: string;
  markerSelectedClass: string;
  underlineClass: string;
  highlightClass: string;
  matches: (edit: Edit) => boolean;
};

/** Default transcript chrome for every Edit kind in the composition matrix. */
export const EDIT_CHROME: readonly EditChromeSpec[] = [
  {
    key: "vfx:text",
    label: "text",
    Icon: Type,
    markerClass: "bg-vfx/80 text-black",
    markerSelectedClass: "bg-vfx text-black",
    underlineClass: "underline decoration-vfx decoration-2 underline-offset-[6px]",
    highlightClass: "bg-vfx/20",
    matches: (e) => e.kind === "vfx" && e.type === "text",
  },
  {
    key: "vfx:quote",
    label: "quote",
    Icon: Quote,
    markerClass: "bg-vfx/80 text-black",
    markerSelectedClass: "bg-vfx text-black",
    underlineClass: "underline decoration-vfx decoration-2 underline-offset-[6px]",
    highlightClass: "bg-vfx/20",
    matches: (e) => e.kind === "vfx" && e.type === "quote",
  },
  {
    key: "broll",
    label: "b-roll",
    Icon: Film,
    markerClass: "bg-broll/80 text-black",
    markerSelectedClass: "bg-broll text-black",
    underlineClass:
      "underline decoration-broll decoration-2 underline-offset-4",
    highlightClass: "bg-broll/20",
    matches: (e) => e.kind === "broll",
  },
  {
    key: "zoom",
    label: "zoom",
    Icon: ZoomIn,
    markerClass: "bg-zoom/80 text-white",
    markerSelectedClass: "bg-zoom text-white",
    underlineClass:
      "underline decoration-zoom decoration-2 underline-offset-4",
    highlightClass: "bg-zoom/15",
    matches: (e) => e.kind === "zoom",
  },
  {
    key: "sfx",
    label: "sfx",
    Icon: Volume2,
    markerClass: "bg-sfx/80 text-black",
    markerSelectedClass: "bg-sfx text-black",
    underlineClass: "underline decoration-sfx decoration-2 underline-offset-4",
    highlightClass: "bg-sfx/20",
    matches: (e) => e.kind === "sfx",
  },
];

const BY_KEY = new Map(EDIT_CHROME.map((s) => [s.key, s]));
const INDEX_BY_KEY = new Map(EDIT_CHROME.map((s, i) => [s.key, i]));

export function chromeForEdit(edit: Edit): EditChromeSpec | undefined {
  return EDIT_CHROME.find((s) => s.matches(edit));
}

export function chromeByKey(key: EditChromeKey): EditChromeSpec {
  const spec = BY_KEY.get(key);
  if (!spec) throw new Error(`Unknown edit chrome key: ${key}`);
  return spec;
}

/** Index in `EDIT_CHROME` — lower wins for idle primary underline. */
export function chromeRank(key: EditChromeKey): number {
  return INDEX_BY_KEY.get(key) ?? Number.MAX_SAFE_INTEGER;
}
