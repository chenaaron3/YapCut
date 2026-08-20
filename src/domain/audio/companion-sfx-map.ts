import { z } from "zod";

export const COMPANION_SFX_CUE_IDS = [
  "broll",
  "zoom",
  "text",
  "quote",
  "listicle",
  "flash",
  "slide",
  "overlayMiddle",
] as const;

export type CompanionSfxCueId = (typeof COMPANION_SFX_CUE_IDS)[number];

export type CompanionSfxSource =
  | { type: "none" }
  | { type: "folder"; folder: string }
  /** Seeded relative paths (`custom/general/camera-flash.mp3`). */
  | { type: "paths"; paths: string[] };

export type CompanionSfxMap = Record<CompanionSfxCueId, CompanionSfxSource>;

export const COMPANION_SFX_CUE_LABELS: Record<CompanionSfxCueId, string> = {
  broll: "B-roll",
  zoom: "Zoom",
  text: "Title",
  quote: "Quote",
  listicle: "Listicle",
  flash: "Flash",
  slide: "Slide",
  overlayMiddle: "Overlay pop",
};

export function defaultCompanionSfxMap(): CompanionSfxMap {
  return {
    broll: { type: "folder", folder: "tick" },
    zoom: { type: "folder", folder: "motion" },
    text: { type: "folder", folder: "reveal" },
    quote: { type: "folder", folder: "tick" },
    listicle: { type: "folder", folder: "reveal" },
    flash: {
      type: "paths",
      paths: ["custom/general/camera-flash.mp3"],
    },
    slide: { type: "paths", paths: ["custom/general/deep.mp3"] },
    overlayMiddle: { type: "folder", folder: "tick" },
  };
}

export const companionSfxSourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("folder"), folder: z.string().min(1) }),
  z.object({
    type: z.literal("paths"),
    paths: z.array(z.string().min(1)),
  }),
]);

export const companionSfxMapSchema = z
  .object({
    broll: companionSfxSourceSchema,
    zoom: companionSfxSourceSchema,
    text: companionSfxSourceSchema,
    quote: companionSfxSourceSchema,
    listicle: companionSfxSourceSchema,
    flash: companionSfxSourceSchema,
    slide: companionSfxSourceSchema,
    overlayMiddle: companionSfxSourceSchema,
  })
  .default(defaultCompanionSfxMap);
