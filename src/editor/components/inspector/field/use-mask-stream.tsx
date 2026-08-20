import { useEffect } from "react";
import { toast } from "sonner";
import { create } from "zustand";

import {
  parseMaskProgress,
  type MaskProgressEvent,
} from "~/domain/asset/mask-progress";
import { useRehydrateFromServer } from "~/editor/lib/project/use-rehydrate-from-server";
import { useEditor } from "~/editor/store";
import { useWorkflowNdjsonStream } from "~/lib/workflow/use-ndjson-stream";

type ProgressStore = {
  byId: Record<string, MaskProgressEvent>;
  put: (assetId: string, event: MaskProgressEvent) => void;
  clear: (assetId: string) => void;
};

export const useMaskProgressStore = create<ProgressStore>((set) => ({
  byId: {},
  put: (assetId, event) =>
    set((state) => ({ byId: { ...state.byId, [assetId]: event } })),
  clear: (assetId) =>
    set((state) => {
      const { [assetId]: _removed, ...byId } = state.byId;
      return { byId };
    }),
}));

function useMaskStream(options: {
  projectId: string;
  assetId: string;
}): void {
  const { projectId, assetId } = options;
  const rehydrate = useRehydrateFromServer();
  const put = useMaskProgressStore((s) => s.put);
  const clear = useMaskProgressStore((s) => s.clear);

  useEffect(() => {
    const snapshot = useEditor
      .getState()
      .assets.find((row) => row.id === assetId)?.mask?.progress;
    if (snapshot) put(assetId, snapshot);
  }, [assetId, put]);

  useWorkflowNdjsonStream({
    url:
      projectId.length > 0 && assetId.length > 0
        ? `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/mask-stream`
        : null,
    parse: parseMaskProgress,
    onEvent: (event) => put(assetId, event),
    onTerminal: async (event) => {
      if (event.stage === "failed") {
        toast.error(event.error ?? "Could not build the mask");
      }
      try {
        await rehydrate();
      } finally {
        clear(assetId);
      }
    },
  });
}

function MaskStreamSync({
  projectId,
  assetId,
}: {
  projectId: string;
  assetId: string;
}) {
  useMaskStream({ projectId, assetId });
  return null;
}

/** One create-style NDJSON stream per in-flight mask job. */
export function MaskStreams() {
  const projectId = useEditor((s) => s.projectId);
  const pendingKey = useEditor((s) =>
    s.assets
      .filter(
        (asset) =>
          asset.mask != null && asset.mask.playbackUrl == null,
      )
      .map((asset) => asset.id)
      .sort()
      .join(","),
  );
  if (!projectId || pendingKey.length === 0) return null;
  const assetIds = pendingKey.split(",");
  return (
    <>
      {assetIds.map((assetId) => (
        <MaskStreamSync
          key={assetId}
          projectId={projectId}
          assetId={assetId}
        />
      ))}
    </>
  );
}
