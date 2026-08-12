import { MUSIC_VOLUME_DEFAULT } from "~/domain/audio/mix-levels";
import type { MusicBed } from "~/domain/project-config";
import { MediaRefFields } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";

export function MusicInspector({ clip }: { clip: MusicBed }) {
  const assets = useEditor((s) => s.assets);
  const clearMusic = useEditor((s) => s.clearMusic);
  const asset = assets.find((a) => a.id === clip.assetId);
  const label =
    asset?.originalFilename?.split(/[/\\]/).pop() ?? clip.assetId.slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <p className="truncate text-[11px] text-muted-foreground" title={label}>
        {label}
      </p>
      <MediaRefFields media={clip} target="music" />
      <p className="text-[10px] leading-snug text-muted-foreground">
        Bed sits low under dialogue
        {clip.volume === MUSIC_VOLUME_DEFAULT ? " (default mix)." : "."} Fades
        in and out at the edges.
      </p>
      <button
        type="button"
        className="rounded border border-border bg-panel-2 px-2 py-1.5 text-[11px] text-foreground hover:border-accent"
        onClick={() => clearMusic()}
      >
        Remove music
      </button>
    </div>
  );
}
