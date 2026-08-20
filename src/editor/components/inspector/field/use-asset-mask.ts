import { toast } from "sonner";

import { useEditor } from "~/editor/store";
import { api } from "~/utils/api";

import type { EditorAsset } from "~/editor/store";
import type { MaskType } from "~/domain/asset/mask";

/** Shared setAssetMask wiring for A-roll Separate background and B-roll Remove background. */
export function useAssetMask(asset: EditorAsset) {
  const projectId = useEditor((s) => s.projectId);
  const addAssets = useEditor((s) => s.addAssets);
  const mutation = api.project.setAssetMask.useMutation({
    onSuccess: (data) => {
      addAssets(data.assets);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const forThisAsset =
    mutation.isPending && mutation.variables?.assetId === asset.id;
  const pending = forThisAsset ? mutation.variables.type : undefined;
  const type = pending !== undefined ? pending : (asset.mask?.type ?? null);
  const masking = type != null && !asset.mask?.playbackUrl;

  const setMask = (next: MaskType | null) => {
    if (!projectId || next === type) return;
    mutation.mutate({
      projectId,
      assetId: asset.id,
      type: next,
    });
  };

  return {
    type,
    isPending: forThisAsset,
    masking,
    setMask,
    canSet: Boolean(projectId),
  };
}
