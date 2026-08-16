import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { BrollPreviewModal } from "~/editor/components/assets/BrollPreviewModal";
import { BrollTile } from "~/editor/components/assets/BrollTile";
import { putToPresignedUrl } from "~/editor/components/assets/put-presigned-url";
import { prepareMediaFileForUpload } from "~/editor/lib/prepare-media-file";
import { probeMediaFile } from "~/editor/lib/probe-media";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

import type { EditorAsset } from "~/editor/store";

export function BrollLibrary({ assets }: { assets: EditorAsset[] }) {
  const projectId = useEditor((s) => s.projectId);
  const addAssets = useEditor((s) => s.addAssets);
  const [importing, setImporting] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewAsset = assets.find((a) => a.id === previewId) ?? null;

  const uploadStart = api.project.uploadAssetsStart.useMutation();
  const uploadFinalize = api.project.uploadAssetsFinalize.useMutation();

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!projectId || accepted.length === 0 || importing) return;
      setImporting(true);
      try {
        const probed = await Promise.all(
          accepted.map(async (raw) => {
            const file = await prepareMediaFileForUpload(raw);
            const meta = await probeMediaFile(file);
            return { file, meta };
          }),
        );

        const { uploads } = await uploadStart.mutateAsync({
          projectId,
          files: probed.map(({ file, meta }) => ({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
            width: meta.width,
            height: meta.height,
            ...(meta.durationSec != null
              ? { durationSec: meta.durationSec }
              : {}),
          })),
        });

        await Promise.all(
          uploads.map((u, i) => {
            const file = probed[i]!.file;
            return putToPresignedUrl(file, u.uploadUrl, u.contentType);
          }),
        );

        const { assets: created } = await uploadFinalize.mutateAsync({
          projectId,
          assetIds: uploads.map((u) => u.assetId),
        });

        addAssets(created);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setImporting(false);
      }
    },
    [projectId, importing, uploadStart, uploadFinalize, addAssets],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (files) => {
      void onDrop(files);
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
      <div className="grid grid-cols-2 content-start gap-2 p-2.5">
        {assets.map((asset) => (
          <BrollTile
            key={asset.id}
            asset={asset}
            onPreview={() => setPreviewId(asset.id)}
          />
        ))}
        {assets.length === 0 && !importing ? (
          <p className="text-muted-foreground col-span-2 text-xs">
            Drop images or videos here, then drag onto the transcript.
          </p>
        ) : null}
        {importing ? (
          <p className="text-muted-foreground col-span-2 text-xs">Importing…</p>
        ) : null}
        {isDragActive ? (
          <p className="text-primary col-span-2 text-center text-xs font-medium">
            Drop media to add
          </p>
        ) : null}
      </div>
      <div className="border-border mt-auto border-t p-2">
        <button
          type="button"
          className="border-border text-muted-foreground hover:bg-panel-2 hover:text-foreground w-full rounded-md border px-2 py-1.5 text-xs disabled:opacity-50"
          disabled={importing || !projectId}
          onClick={() => open()}
        >
          Upload b-roll
        </button>
      </div>
      <BrollPreviewModal
        asset={previewAsset}
        open={previewAsset != null}
        onClose={() => setPreviewId(null)}
      />
    </div>
  );
}
