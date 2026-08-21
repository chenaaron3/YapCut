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

export type PendingUpload = {
  id: string;
  filename: string;
  previewUrl: string;
  kind: "image" | "video" | "audio";
};

function kindFromFile(file: File): PendingUpload["kind"] {
  const type = file.type.toLowerCase();
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("image/")) return "image";
  const name = file.name.toLowerCase();
  if (/\.(mp4|mov|webm|m4v)$/.test(name)) return "video";
  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(name)) return "audio";
  return "image";
}

function revokePending(items: readonly PendingUpload[]) {
  for (const item of items) URL.revokeObjectURL(item.previewUrl);
}

/**
 * Shared editor upload: probe in the caller, then start → PUT → finalize → library.
 * Shows optimistic local thumbs while the upload runs.
 */
export function useAssetUpload(options?: { onBeforeUpload?: () => void }) {
  const onBeforeUpload = options?.onBeforeUpload;
  const [importing, setImporting] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const importingRef = useRef(false);
  const pendingRef = useRef<PendingUpload[]>([]);
  const uploadStart = api.project.uploadAssetsStart.useMutation();
  const uploadFinalize = api.project.uploadAssetsFinalize.useMutation();

  const clearPending = useCallback(() => {
    revokePending(pendingRef.current);
    pendingRef.current = [];
    setPending([]);
  }, []);

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

      const nextPending = accepted.map((file) => ({
        id: crypto.randomUUID(),
        filename: file.name,
        previewUrl: URL.createObjectURL(file),
        kind: kindFromFile(file),
      }));
      pendingRef.current = nextPending;
      setPending(nextPending);

      try {
        const prepared = await Promise.all(
          accepted.map(async (raw, i) => {
            const result = await prepare(raw);
            const slot = pendingRef.current[i];
            if (slot && result.file !== raw) {
              URL.revokeObjectURL(slot.previewUrl);
              const updated: PendingUpload = {
                ...slot,
                filename: result.file.name,
                previewUrl: URL.createObjectURL(result.file),
                kind: kindFromFile(result.file),
              };
              pendingRef.current = pendingRef.current.map((p, j) =>
                j === i ? updated : p,
              );
              setPending([...pendingRef.current]);
            }
            return result;
          }),
        );
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
        clearPending();
        importingRef.current = false;
        setImporting(false);
      }
    },
    [onBeforeUpload, uploadStart, uploadFinalize, clearPending],
  );

  return { importing, pending, importFiles };
}
