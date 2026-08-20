import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { BrollPreviewModal } from "~/editor/components/assets/BrollPreviewModal";
import { BrollTile } from "~/editor/components/assets/BrollTile";
import { useAssetUpload } from "~/editor/components/assets/useAssetUpload";
import { PickerEmpty, PickerGrid } from "~/editor/components/picker";
import { prepareMediaFileForUpload } from "~/editor/lib/prepare-media-file";
import { probeMediaFile } from "~/editor/lib/probe-media";
import { useRehydrateFromServer } from "~/editor/lib/use-rehydrate-from-server";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

import type { EditorAsset } from "~/editor/store";

export function BrollLibrary({ assets }: { assets: EditorAsset[] }) {
  const projectId = useEditor((s) => s.projectId);
  const rehydrateFromServer = useRehydrateFromServer();
  const { importing, importFiles } = useAssetUpload();
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [previewId, setPreviewId] = useState<string | null>(null);
  const visibleAssets = useMemo(
    () => assets.filter((asset) => !hiddenIds.has(asset.id)),
    [assets, hiddenIds],
  );
  const previewAsset = visibleAssets.find((a) => a.id === previewId) ?? null;

  const removeAsset = api.project.removeBrollAsset.useMutation();

  const onRemove = useCallback(
    async (assetId: string) => {
      if (!projectId || hiddenIds.has(assetId)) return;
      setHiddenIds((prev) => new Set(prev).add(assetId));
      setPreviewId((id) => (id === assetId ? null : id));
      try {
        const editor = useEditor.getState();
        if (editor.configDirty || editor.transcriptsDirty) await editor.save();
        await removeAsset.mutateAsync({ projectId, assetId });
        await rehydrateFromServer([assetId]);
      } catch (err) {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(assetId);
          return next;
        });
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [projectId, hiddenIds, removeAsset, rehydrateFromServer],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (files) => {
      void importFiles(files, async (raw) => {
        const file = await prepareMediaFileForUpload(raw);
        const meta = await probeMediaFile(file);
        return {
          file,
          contentType: file.type || "application/octet-stream",
          width: meta.width,
          height: meta.height,
          ...(meta.durationSec != null
            ? { durationSec: meta.durationSec }
            : {}),
        };
      });
    },
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
      "video/*": [".mp4", ".mov", ".webm", ".m4v"],
    },
    multiple: true,
    noClick: true,
    noKeyboard: true,
    disabled: importing || !projectId,
  });

  return (
    <div
      {...getRootProps()}
      className={cn("flex min-h-full flex-col", isDragActive && "bg-primary/5")}
    >
      <input {...getInputProps()} />
      <PickerGrid className="p-2">
        {visibleAssets.map((asset) => (
          <BrollTile
            key={asset.id}
            asset={asset}
            onPreview={() => setPreviewId(asset.id)}
            onRemove={() => void onRemove(asset.id)}
          />
        ))}
        {visibleAssets.length === 0 && !importing ? (
          <PickerEmpty>
            Drop images or videos here, then drag onto the transcript.
          </PickerEmpty>
        ) : null}
        {importing ? <PickerEmpty>Importing…</PickerEmpty> : null}
        {isDragActive ? <PickerEmpty>Drop media to add</PickerEmpty> : null}
      </PickerGrid>
      <BrollPreviewModal
        asset={previewAsset}
        open={previewAsset != null}
        onClose={() => setPreviewId(null)}
      />
    </div>
  );
}
