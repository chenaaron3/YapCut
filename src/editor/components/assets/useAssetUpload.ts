import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { putToPresignedUrl } from "~/editor/components/assets/put-presigned-url";
import { useEditor } from "~/editor/store";
import { api } from "~/utils/api";

import type { RouterInputs } from "~/utils/api";

type StartFile = RouterInputs["project"]["uploadAssetsStart"]["files"][number];

export type PreparedAssetUpload = {
  file: File;
} & Omit<StartFile, "filename" | "size">;

/**
 * Shared editor upload: probe in the caller, then start → PUT → finalize → library.
 */
export function useAssetUpload(options?: { onBeforeUpload?: () => void }) {
  const onBeforeUpload = options?.onBeforeUpload;
  const [importing, setImporting] = useState(false);
  const importingRef = useRef(false);
  const uploadStart = api.project.uploadAssetsStart.useMutation();
  const uploadFinalize = api.project.uploadAssetsFinalize.useMutation();

  const importFiles = useCallback(
    async (
      accepted: File[],
      prepare: (file: File) => Promise<PreparedAssetUpload>,
    ) => {
      const projectId = useEditor.getState().projectId;
      if (!projectId || accepted.length === 0 || importingRef.current) return;
      importingRef.current = true;
      setImporting(true);
      onBeforeUpload?.();
      try {
        const prepared = await Promise.all(accepted.map(prepare));
        const { uploads } = await uploadStart.mutateAsync({
          projectId,
          files: prepared.map(
            ({ file, contentType, width, height, durationSec }) => ({
              filename: file.name,
              contentType,
              size: file.size,
              ...(width != null ? { width } : {}),
              ...(height != null ? { height } : {}),
              ...(durationSec != null ? { durationSec } : {}),
            }),
          ),
        });
        await Promise.all(
          uploads.map((upload, i) => {
            const file = prepared[i]!.file;
            return putToPresignedUrl(
              file,
              upload.uploadUrl,
              upload.contentType,
            );
          }),
        );
        const { assets } = await uploadFinalize.mutateAsync({
          projectId,
          assetIds: uploads.map((upload) => upload.assetId),
        });
        useEditor.getState().addAssets(assets);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        importingRef.current = false;
        setImporting(false);
      }
    },
    [onBeforeUpload, uploadStart, uploadFinalize],
  );

  return { importing, importFiles };
}
