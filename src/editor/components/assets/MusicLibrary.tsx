import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import {
  mixPlaybackVolume,
  MUSIC_VOLUME_DEFAULT,
} from "~/domain/audio/mix-levels";
import { putToPresignedUrl } from "~/editor/components/assets/put-presigned-url";
import { useAudioPreview } from "~/editor/components/assets/useAudioPreview";
import { probeAudioFile } from "~/editor/lib/probe-media";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

import type { EditorAsset } from "~/editor/store";

function musicLabel(asset: EditorAsset): string {
  const name =
    asset.originalFilename?.split(/[/\\]/).pop() ?? asset.id.slice(0, 8);
  return name.replace(/\.[^.]+$/, "");
}

export function MusicLibrary({ assets }: { assets: EditorAsset[] }) {
  const projectId = useEditor((s) => s.projectId);
  const config = useEditor((s) => s.config);
  const setMusic = useEditor((s) => s.setMusic);
  const addAssets = useEditor((s) => s.addAssets);
  const openMusicPanel = useSelection((s) => s.openMusicPanel);
  const activeId = config?.music?.assetId ?? null;
  const mixVolume = config?.music?.volume ?? MUSIC_VOLUME_DEFAULT;
  const { playingKey, preview, stopPreview } = useAudioPreview();
  const [importing, setImporting] = useState(false);

  const uploadStart = api.project.uploadAssetsStart.useMutation();
  const uploadFinalize = api.project.uploadAssetsFinalize.useMutation();

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!projectId || accepted.length === 0 || importing) return;
      setImporting(true);
      stopPreview();
      try {
        const probed = await Promise.all(
          accepted.map(async (file) => {
            const meta = await probeAudioFile(file);
            return { file, meta };
          }),
        );

        const { uploads } = await uploadStart.mutateAsync({
          projectId,
          files: probed.map(({ file, meta }) => ({
            filename: file.name,
            contentType: file.type || "audio/mpeg",
            size: file.size,
            durationSec: meta.durationSec,
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
    [projectId, importing, uploadStart, uploadFinalize, addAssets, stopPreview],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      void onDrop(accepted);
    },
    noClick: true,
    noKeyboard: true,
    multiple: true,
    accept: {
      "audio/mpeg": [".mp3"],
      "audio/wav": [".wav"],
      "audio/x-wav": [".wav"],
      "audio/mp4": [".m4a"],
      "audio/aac": [".m4a"],
      "audio/ogg": [".ogg"],
      "audio/flac": [".flac"],
    },
  });

  return (
    <div {...getRootProps()} className="min-h-0 flex-1 overflow-auto">
      <input {...getInputProps()} />
      <div className="flex flex-col gap-1 p-2.5">
        {assets.map((asset) => {
          const active = asset.id === activeId;
          const previewVol = mixPlaybackVolume(
            mixVolume,
            asset.lufs,
            asset.truePeakDb,
            MUSIC_VOLUME_DEFAULT,
          );
          return (
            <div
              key={asset.id}
              className={cn(
                "bg-panel-2 flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 select-none",
                active
                  ? "border-music ring-music ring-1"
                  : "border-border hover:border-music/60",
              )}
              onClick={() => {
                stopPreview();
                if (active) {
                  openMusicPanel();
                  return;
                }
                setMusic(asset.id);
              }}
              title={`${musicLabel(asset)}${
                asset.durationSec != null
                  ? ` (${asset.durationSec.toFixed(1)}s)`
                  : ""
              }`}
            >
              <button
                type="button"
                className="bg-music/25 text-music hover:bg-music/40 flex h-7 w-7 shrink-0 items-center justify-center rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  preview(asset.id, asset.playbackUrl, previewVol);
                }}
                title={playingKey === asset.id ? "Stop" : "Preview"}
              >
                {playingKey === asset.id ? "■" : "▶"}
              </button>
              <span className="text-foreground min-w-0 flex-1 truncate text-[11px]">
                {musicLabel(asset)}
              </span>
              <span className="text-muted-foreground shrink-0 text-[10px]">
                {active
                  ? "On"
                  : asset.durationSec != null
                    ? `${asset.durationSec.toFixed(0)}s`
                    : ""}
              </span>
            </div>
          );
        })}
        {assets.length === 0 && !importing ? (
          <p className="text-muted-foreground text-xs">
            Drop audio here, or run{" "}
            <code className="text-[10px]">npm run seed:global</code>.
          </p>
        ) : null}
        {importing ? (
          <p className="text-muted-foreground text-xs">Importing…</p>
        ) : null}
        {isDragActive ? (
          <p className="text-accent text-center text-xs font-medium">
            Drop audio to add
          </p>
        ) : null}
      </div>
    </div>
  );
}
