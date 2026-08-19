import { z } from "zod";

import type { MediaRef } from "~/domain/project-config";

export const MOTION_MAX_PROMPT = 2000;

export const MOTION_CATEGORIES = [
  "stat",
  "charts",
  "lower-thirds",
  "news",
  "asset-fusion",
  "checklist",
] as const;

export type MotionCategory = (typeof MOTION_CATEGORIES)[number];

const mediaRefSchema = z.object({
  assetId: z.string().min(1),
  mediaOffsetSec: z.number(),
  volume: z.number(),
});

export function stillMediaRef(assetId: string): MediaRef {
  return { assetId, mediaOffsetSec: 0, volume: 1 };
}

export const statContentSchema = z.object({
  value: z.number(),
  prefix: z.string(),
  suffix: z.string(),
  label: z.string(),
  ring: z.boolean(),
});

export const chartsContentSchema = z.object({
  type: z.enum(["bar", "line", "pie", "race", "pct"]),
  data: z.array(z.number()).min(1).max(16),
  labels: z.array(z.string()).max(16),
  headline: z.string(),
  axes: z.boolean(),
  colors: z.array(z.string()).max(16).nullable(),
});

export const lowerThirdsContentSchema = z.object({
  kind: z.enum(["name-bar", "chip"]),
  title: z.string(),
  detail: z.string(),
  position: z.enum(["lower-left", "lower-third", "corner", "upper-left"]),
  brandColors: z.array(z.string()).max(8),
});

export const newsContentSchema = z.object({
  outlet: z.string(),
  kicker: z.string(),
  headline: z.string(),
  keyword: z.string(),
});

export const assetFusionContentSchema = z.object({
  label: z.string(),
  box: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }),
  media: mediaRefSchema,
});

export const checklistContentSchema = z.object({
  headline: z.string(),
  items: z
    .array(
      z.object({
        label: z.string(),
        /** Seconds from overlay start. Copy from numbered word times. */
        atSec: z.number(),
      }),
    )
    .min(1)
    .max(8),
});

function envelope<C extends MotionCategory, S extends z.ZodTypeAny>(
  category: C,
  content: S,
) {
  return z.object({
    category: z.literal(category),
    brief: z.string(),
    style: z.string(),
    content,
  });
}

export const shotPlanSchema = z.discriminatedUnion("category", [
  envelope("stat", statContentSchema),
  envelope("charts", chartsContentSchema),
  envelope("lower-thirds", lowerThirdsContentSchema),
  envelope("news", newsContentSchema),
  envelope("asset-fusion", assetFusionContentSchema),
  envelope("checklist", checklistContentSchema),
]);

export type ShotPlan = z.infer<typeof shotPlanSchema>;
export type StatContent = z.infer<typeof statContentSchema>;
export type ChartsContent = z.infer<typeof chartsContentSchema>;
export type LowerThirdsContent = z.infer<typeof lowerThirdsContentSchema>;
export type NewsContent = z.infer<typeof newsContentSchema>;
export type AssetFusionContent = z.infer<typeof assetFusionContentSchema>;
export type ChecklistContent = z.infer<typeof checklistContentSchema>;

/** Only asset-fusion sources a still. */
export function motionAcceptsAssetNeeds(category: MotionCategory): boolean {
  return category === "asset-fusion";
}

/** Fusion still; null for form categories. */
export function motionMediaRef(plan: ShotPlan): MediaRef | null {
  return plan.category === "asset-fusion" ? plan.content.media : null;
}

/** Stamp a sourced still onto asset-fusion. Other categories unchanged. */
export function withMotionMedia(plan: ShotPlan, ref?: MediaRef): ShotPlan {
  if (plan.category !== "asset-fusion" || !ref) return plan;
  return { ...plan, content: { ...plan.content, media: ref } };
}
