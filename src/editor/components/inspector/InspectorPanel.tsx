import { X } from "lucide-react";

import { ArollAssetInspector } from "~/editor/components/inspector/ArollAssetInspector";
import { BrollAssetInspector } from "~/editor/components/inspector/BrollAssetInspector";
import { BRollInspector } from "~/editor/components/inspector/BRollInspector";
import { CaptionsInspector } from "~/editor/components/inspector/CaptionsInspector";
import { CompanionSfxFields } from "~/editor/components/inspector/field";
import { ListicleVfxInspector } from "~/editor/components/inspector/ListicleVfxInspector";
import { MotionVfxInspector } from "~/editor/components/inspector/MotionVfxInspector";
import { MusicInspector } from "~/editor/components/inspector/MusicInspector";
import { ProjectSettingsInspector } from "~/editor/components/inspector/ProjectSettingsInspector";
import { QuoteVfxInspector } from "~/editor/components/inspector/QuoteVfxInspector";
import { SfxInspector } from "~/editor/components/inspector/SfxInspector";
import { ShakeVfxInspector } from "~/editor/components/inspector/ShakeVfxInspector";
import { StickerInspector } from "~/editor/components/inspector/StickerInspector";
import { TextVfxInspector } from "~/editor/components/inspector/TextVfxInspector";
import { TransitionInspector } from "~/editor/components/inspector/TransitionInspector";
import { WordInspector } from "~/editor/components/inspector/WordInspector";
import { ZoomInspector } from "~/editor/components/inspector/ZoomInspector";
import { selectedArollAssetId } from "~/editor/lib/selection/aroll-asset-selection";
import { primaryAssetId, primaryId } from "~/editor/lib/selection/selection";
import { usePlayerPlaying } from "~/editor/lib/player/use-player-playing";
import { useSelection } from "~/editor/selection-store";
import { useEditor, useGlobalWords } from "~/editor/store";

import type { Edit } from "~/domain/project/project-config";
import type { ReactNode } from "react";

/**
 * Selection inspector column. Always reserves ~25% of the transcript row
 * so opening/closing a selection does not reflow the words.
 */
export function InspectorPanel() {
  const words = useGlobalWords();
  const playing = usePlayerPlaying();
  const selection = useSelection((s) => {
    if (s.selection?.kind === "edit") return s.selection;
    if (s.selection?.kind === "aroll") return s.selection;
    if (s.selection?.kind === "broll") return s.selection;
    if (s.selection?.kind === "word") {
      const hasEmphasis = s.selection.ids.some(
        (id) => typeof id === "number" && words[id]?.emphasized,
      );
      return hasEmphasis ? s.selection : null;
    }
    return null;
  });
  const projectPanel = useSelection((s) => s.projectPanel);
  const config = useEditor((s) => s.config);
  const assets = useEditor((s) => s.assets);
  const getLayout = useEditor((s) => s.getLayout);
  const clearSelection = useSelection((s) => s.clearSelection);

  let title: string | null = null;
  let body: ReactNode = null;
  let companionEdit: Edit | null = null;

  if (projectPanel === "settings") {
    title = "Settings";
    body = <ProjectSettingsInspector />;
  } else if (projectPanel === "captions") {
    title = "Captions";
    body = <CaptionsInspector />;
  } else if (projectPanel === "music") {
    if (config?.music) {
      title = "Music";
      body = <MusicInspector clip={config.music} />;
    }
  } else if (selection?.kind === "word" && !playing) {
    title = "Word";
    body = <WordInspector />;
  } else if (selection?.kind === "aroll") {
    const assetId = selectedArollAssetId(selection, getLayout());
    const asset =
      assetId != null ? assets.find((a) => a.id === assetId) : undefined;
    if (asset && (asset.kind === "image" || asset.kind === "video")) {
      title = "A-roll";
      body = <ArollAssetInspector asset={asset} />;
    }
  } else if (selection?.kind === "broll") {
    const id = primaryAssetId(selection);
    const asset = id != null ? assets.find((a) => a.id === id) : undefined;
    if (asset && (asset.kind === "image" || asset.kind === "video")) {
      title = "B-roll";
      body = <BrollAssetInspector asset={asset} />;
    }
  } else if (selection?.kind === "edit" && config) {
    const id = primaryId(selection);
    const edit = id != null ? config.edits.find((e) => e.id === id) : undefined;
    if (edit?.kind === "vfx" && edit.type === "text") {
      title = "Title";
      body = <TextVfxInspector edit={edit} />;
    } else if (edit?.kind === "vfx" && edit.type === "quote") {
      title = "Quote";
      body = <QuoteVfxInspector edit={edit} />;
    } else if (edit?.kind === "vfx" && edit.type === "listicle") {
      title = "Listicle";
      body = <ListicleVfxInspector edit={edit} />;
    } else if (edit?.kind === "vfx" && edit.type === "shake") {
      title = "Shake";
      body = <ShakeVfxInspector edit={edit} />;
    } else if (edit?.kind === "vfx" && edit.type === "motion") {
      title = "Motion";
      body = <MotionVfxInspector edit={edit} />;
    } else if (edit?.kind === "broll") {
      title = "B-roll";
      body = <BRollInspector edit={edit} />;
    } else if (edit?.kind === "sticker") {
      title = "Sticker";
      body = <StickerInspector edit={edit} />;
    } else if (edit?.kind === "sfx") {
      title = "SFX";
      body = <SfxInspector edit={edit} />;
    } else if (edit?.kind === "zoom") {
      title = "Zoom";
      body = <ZoomInspector edit={edit} />;
    } else if (edit?.kind === "transition") {
      title = "Transition";
      body = <TransitionInspector edit={edit} />;
    }
    if (edit && edit.kind !== "sfx") companionEdit = edit;
  }

  return (
    <aside
      className="border-border bg-panel hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l lg:flex"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {title && body ? (
        <>
          <div className="border-border flex shrink-0 items-center justify-between border-b px-3 py-2">
            <h2 className="ember-mono text-foreground text-[10px] font-medium tracking-[.12em] uppercase">
              {title}
            </h2>
            <button
              type="button"
              className="text-muted-foreground hover:bg-panel-2 hover:text-foreground rounded p-0.5"
              aria-label="Close inspector"
              onClick={() => clearSelection()}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3">
            {body}
            {companionEdit ? (
              <div className="mt-4">
                <CompanionSfxFields edit={companionEdit} />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </aside>
  );
}
