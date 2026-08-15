import { MUSIC_VOLUME_DEFAULT } from "~/domain/audio/mix-levels";
import { MediaRefFields } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";

import type { MusicBed } from "~/domain/project-config";

export function MusicInspector({ clip }: { clip: MusicBed }) {
  const assets = useEditor((s) => s.assets);
  const clearMusic = useEditor((s) => s.clearMusic);
  const asset = assets.find((a) => a.id === clip.assetId);
  const label =
    asset?.originalFilename?.split(/[/\\]/).pop() ?? clip.assetId.slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground truncate text-[11px]" title={label}>
        {label}
      </p>
      <MediaRefFields media={clip} target="music" />
      <button
        type="button"
        className="border-border bg-panel-2 text-foreground hover:border-accent rounded border px-2 py-1.5 text-[11px]"
        onClick={() => clearMusic()}
      >
        Remove music
      </button>
    </div>
  );
}
