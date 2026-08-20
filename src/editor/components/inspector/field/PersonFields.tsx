import { durationMapFromAssets } from "~/domain/aroll/arolls";
import { maskTypeByAssetId, timelineRangeOverlapsMask } from "~/domain/asset/mask";
import { InspectorPills } from "~/editor/components/inspector/field/InspectorPills";
import { useEditor } from "~/editor/store";

import type { Edit } from "~/domain/project/project-config";

const PERSON_OPTIONS = [
  { id: "front", label: "In front" },
  { id: "behind", label: "Behind" },
] as const;

export function PersonFields({ edit }: { edit: Edit }) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const arolls = useEditor((s) => s.config?.arolls);
  const assets = useEditor((s) => s.assets);
  const masked = timelineRangeOverlapsMask(
    arolls ?? [],
    durationMapFromAssets(assets),
    maskTypeByAssetId(assets),
    edit,
  );
  if (!masked) return null;

  const behind = "behindPerson" in edit && edit.behindPerson === true;

  return (
    <InspectorPills
      label="Person"
      variant="tabs"
      value={behind ? "behind" : "front"}
      options={PERSON_OPTIONS}
      onChange={(id) =>
        patchEdit(edit.id, { behindPerson: id === "behind" })
      }
    />
  );
}
