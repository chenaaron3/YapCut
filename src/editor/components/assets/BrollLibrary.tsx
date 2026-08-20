import { Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { BrollGenerateModal } from "~/editor/components/assets/broll-generate";
import { BrollPreviewModal } from "~/editor/components/assets/BrollPreviewModal";
import { BrollTile } from "~/editor/components/assets/BrollTile";
import { useAssetUpload } from "~/editor/components/assets/useAssetUpload";
import { PickerEmpty, PickerGrid } from "~/editor/components/picker";
import { prepareMediaFileForUpload } from "~/editor/lib/player/prepare-media-file";
import { probeMediaFile } from "~/editor/lib/player/probe-media";
import { useRehydrateFromServer } from "~/editor/lib/project/use-rehydrate-from-server";
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
  const [generateOpen, setGenerateOpen] = useState(false);
  const visibleAssets = useMemo(
    () => assets.filter((asset) => !hiddenIds.has(asset.id)),
    [assets, hiddenIds],
  );
  const imageAssets = useMemo(
    () => visibleAssets.filter((asset) => asset.kind === "image"),
    [visibleAssets],
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
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
      <div className="border-border flex shrink-0 items-center border-b px-2 py-1.5">
        <Button
          type="button"
          size="sm"
          disabled={!projectId || importing}
          onClick={() => setGenerateOpen(true)}
        >
          <Sparkles className="size-3.5" />
          Generate
        </Button>
      </div>
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
          <PickerEmpty>Drop images or videos here</PickerEmpty>
        ) : null}
        {importing ? <PickerEmpty>Importing…</PickerEmpty> : null}
        {isDragActive ? <PickerEmpty>Drop media to add</PickerEmpty> : null}
      </PickerGrid>
      <BrollGenerateModal
        imageAssets={imageAssets}
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
      />
      <BrollPreviewModal
        asset={previewAsset}
        open={previewAsset != null}
        onClose={() => setPreviewId(null)}
      />
    </div>
  );
}
