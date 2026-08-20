import { useCallback } from "react";

import { isEditorProjectStatus } from "~/domain/project-status";
import { hydrateInputFromProject } from "~/editor/lib/hydrate-project";
import { useEditor } from "~/editor/store";
import { api } from "~/utils/api";

/** Refetch the open project and replace the working copy. `omitAssetIds` drop extras that the snapshot must not resurrect. */
export function useRehydrateFromServer() {
  const utils = api.useUtils();

  return useCallback(
    async (omitAssetIds: readonly string[] = []) => {
      const projectId = useEditor.getState().projectId;
      if (!projectId) return;
      const data = await utils.project.byId.fetch({ id: projectId });
      if (!data || !isEditorProjectStatus(data.status)) return;
      const omit = new Set(omitAssetIds);
      const { assets, hydrateFromServer } = useEditor.getState();
      hydrateFromServer(
        hydrateInputFromProject(
          data,
          assets.filter((asset) => !omit.has(asset.id)),
        ),
      );
    },
    [utils],
  );
}
