import { useDropzone } from "react-dropzone";

import {
  mixPlaybackVolume,
  MUSIC_VOLUME_DEFAULT,
} from "~/domain/audio/mix-levels";
import { useAssetUpload } from "~/editor/components/assets/useAssetUpload";
import { useAudioPreview } from "~/editor/components/assets/useAudioPreview";
import {
  PickerEmpty,
  PickerGrid,
  PickerTile,
} from "~/editor/components/picker";
import { probeAudioFile } from "~/editor/lib/player/probe-media";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";

import type { EditorAsset } from "~/editor/store";

function musicLabel(asset: EditorAsset): string {
  const name =
    asset.originalFilename?.split(/[/\\]/).pop() ?? asset.id.slice(0, 8);
  return name.replace(/\.[^.]+$/, "");
}

export function MusicLibrary({ assets }: { assets: EditorAsset[] }) {
  const config = useEditor((s) => s.config);
  const setMusic = useEditor((s) => s.setMusic);
  const openMusicPanel = useSelection((s) => s.openMusicPanel);
  const activeId = config?.music?.assetId ?? null;
  const mixVolume = config?.music?.volume ?? MUSIC_VOLUME_DEFAULT;
  const { playingKey, preview, stopPreview } = useAudioPreview();
  const { importing, importFiles } = useAssetUpload({
    onBeforeUpload: stopPreview,
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      void importFiles(accepted, async (file) => {
        const meta = await probeAudioFile(file);
        return {
          file,
          contentType: file.type || "audio/mpeg",
          durationSec: meta.durationSec,
        };
      });
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
      <PickerGrid className="p-2">
        {assets.map((asset) => {
          const active = asset.id === activeId;
          const previewVol = mixPlaybackVolume(
            mixVolume,
            asset.lufs,
            asset.truePeakDb,
            MUSIC_VOLUME_DEFAULT,
          );
          const playing = playingKey === asset.id;
          return (
            <PickerTile
              key={asset.id}
              label={musicLabel(asset)}
              selected={active}
              thumbClassName="bg-music/25 text-music"
              className="cursor-pointer"
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
                className="flex size-full items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  preview(asset.id, asset.playbackUrl, previewVol);
                }}
                title={playing ? "Stop" : "Preview"}
              >
                {playing ? "■" : "▶"}
              </button>
            </PickerTile>
          );
        })}
        {assets.length === 0 && !importing ? (
          <PickerEmpty>
            Drop audio here, or run{" "}
            <code className="text-[10px]">npm run seed:global</code>.
          </PickerEmpty>
        ) : null}
        {importing ? <PickerEmpty>Importing…</PickerEmpty> : null}
        {isDragActive ? <PickerEmpty>Drop audio to add</PickerEmpty> : null}
      </PickerGrid>
    </div>
  );
}
