import { captionTemplateStyle } from "~/domain/project/project-config";
import { TRANSFORM_DEFAULTS } from "~/domain/edit/transform";

import type { Edit, VfxMotionEdit } from "~/domain/project/project-config";

export function isMotionEdit(edit: Edit): edit is VfxMotionEdit {
  return edit.kind === "vfx" && edit.type === "motion";
}

export function motionLabel(
  edit: Pick<VfxMotionEdit, "plan">,
): string {
  if (edit.plan) return edit.plan.category;
  return "Motion";
}

export function motionSeed(): Omit<VfxMotionEdit, "id" | "start" | "end"> {
  return {
    kind: "vfx",
    type: "motion",
    plan: null,
    hideCaptions: false,
    style: captionTemplateStyle(),
    ...TRANSFORM_DEFAULTS,
  };
}
