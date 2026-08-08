import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

import { BrollTile } from "~/editor/components/assets/BrollTile";
import { putToPresignedUrl } from "~/editor/components/assets/put-presigned-url";
import { prepareMediaFileForUpload } from "~/editor/lib/prepare-media-file";
import { probeMediaFile } from "~/editor/lib/probe-media";
import { useEditor, type EditorAsset } from "~/editor/store";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

export function BrollLibrary({ assets }: { assets: EditorAsset[] }) {
  const projectId = useEditor((s) => s.projectId);
  const addAssets = useEditor((s) => s.addAssets);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const uploadStart = api.project.uploadAssetsStart.useMutation();
  const uploadFinalize = api.project.uploadAssetsFinalize.useMutation();

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!projectId || accepted.length === 0 || importing) return;
      setError(null);
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

        addAssets(
          created.map((a) => ({
            id: a.id,
            kind: a.kind,
            playbackUrl: a.playbackUrl,
            durationSec: a.durationSec,
            width: a.width,
            height: a.height,
            originalFilename: a.originalFilename,
            sortOrder: a.sortOrder,
          })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setImporting(false);
      }
    },
    [projectId, importing, uploadStart, uploadFinalize, addAssets],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
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
      className={cn(
        "flex min-h-full flex-col",
        isDragActive && "bg-primary/5",
      )}
    >
      <input {...getInputProps()} />
      <div className="grid grid-cols-2 content-start gap-2 p-2.5">
        {assets.map((asset) => (
          <BrollTile key={asset.id} asset={asset} />
        ))}
        {assets.length === 0 && !importing ? (
          <p className="col-span-2 text-xs text-muted-foreground">
            Drop images or videos here, then drag onto the transcript.
          </p>
        ) : null}
        {importing ? (
          <p className="col-span-2 text-xs text-muted-foreground">
            Importing…
          </p>
        ) : null}
        {error ? (
          <p className="col-span-2 text-xs text-red-400">{error}</p>
        ) : null}
        {isDragActive ? (
          <p className="col-span-2 text-center text-xs font-medium text-primary">
            Drop media to add
          </p>
        ) : null}
      </div>
      <div className="mt-auto border-t border-border p-2">
        <button
          type="button"
          className="w-full rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-panel-2 hover:text-foreground disabled:opacity-50"
          disabled={importing || !projectId}
          onClick={() => open()}
        >
          Upload b-roll
        </button>
      </div>
    </div>
  );
}
