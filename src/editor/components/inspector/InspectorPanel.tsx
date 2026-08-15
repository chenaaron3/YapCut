import type { ReactNode } from "react";
import { X } from "lucide-react";

import type { Edit } from "~/domain/project-config";
import { BRollInspector } from "~/editor/components/inspector/BRollInspector";
import { CompanionSfxFields } from "~/editor/components/inspector/field";
import { CaptionsInspector } from "~/editor/components/inspector/CaptionsInspector";
import { ListicleVfxInspector } from "~/editor/components/inspector/ListicleVfxInspector";
import { MusicInspector } from "~/editor/components/inspector/MusicInspector";
import { ProjectSettingsInspector } from "~/editor/components/inspector/ProjectSettingsInspector";
import { QuoteVfxInspector } from "~/editor/components/inspector/QuoteVfxInspector";
import { SfxInspector } from "~/editor/components/inspector/SfxInspector";
import { ShakeVfxInspector } from "~/editor/components/inspector/ShakeVfxInspector";
import { TextVfxInspector } from "~/editor/components/inspector/TextVfxInspector";
import { TransitionInspector } from "~/editor/components/inspector/TransitionInspector";
import { ZoomInspector } from "~/editor/components/inspector/ZoomInspector";
import { primaryId } from "~/editor/lib/selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";

/**
 * Selection inspector column. Always reserves ~25% of the transcript row
 * so opening/closing a selection does not reflow the words.
 */
export function InspectorPanel() {
  // Ignore word-playback selection churn — inspector only shows edit/project panels.
  const selection = useSelection((s) =>
    s.selection?.kind === "edit" ? s.selection : null,
  );
  const projectPanel = useSelection((s) => s.projectPanel);
  const config = useEditor((s) => s.config);
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
  } else if (selection?.kind === "edit" && config) {
    const id = primaryId(selection);
    const edit =
      id != null ? config.edits.find((e) => e.id === id) : undefined;
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
    } else if (edit?.kind === "broll") {
      title = "B-roll";
      body = <BRollInspector edit={edit} />;
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
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-panel"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {title && body ? (
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-xs font-medium tracking-wide text-foreground">
              {title}
            </h2>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-panel-2 hover:text-foreground"
              aria-label="Close inspector"
              onClick={() => clearSelection()}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
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
