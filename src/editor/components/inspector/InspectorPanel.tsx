import type { ReactNode } from "react";
import { X } from "lucide-react";

import { CaptionsInspector } from "~/editor/components/inspector/CaptionsInspector";
import { TextVfxInspector } from "~/editor/components/inspector/TextVfxInspector";
import { primaryId } from "~/editor/lib/selection";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";

/**
 * Selection inspector column. Always reserves ~25% of the transcript row
 * so opening/closing a selection does not reflow the words.
 */
export function InspectorPanel() {
  const selection = useSelection((s) => s.selection);
  const projectPanel = useSelection((s) => s.projectPanel);
  const config = useEditor((s) => s.config);
  const clearSelection = useSelection((s) => s.clearSelection);

  let title: string | null = null;
  let body: ReactNode = null;

  if (projectPanel === "captions") {
    title = "Captions";
    body = <CaptionsInspector />;
  } else if (selection?.kind === "edit" && config) {
    const id = primaryId(selection);
    const edit =
      id != null ? config.edits.find((e) => e.id === id) : undefined;
    if (edit?.kind === "vfx" && edit.type === "text") {
      title = "Title";
      body = <TextVfxInspector edit={edit} />;
    } else if (edit?.kind === "zoom") {
      title = "Zoom";
      body = (
        <p className="text-xs text-muted-foreground">
          Drag timeline handles to adjust range.
        </p>
      );
    }
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
          </div>
        </>
      ) : null}
    </aside>
  );
}
