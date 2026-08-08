import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { AssetsPanel } from "~/editor/components/AssetsPanel";
import { Timeline } from "~/editor/components/timeline/Timeline";
import { TranscriptPanel } from "~/editor/components/transcript/TranscriptPanel";
import { getPlayer, togglePlayback } from "~/editor/lib/player-bridge";
import { useSelection } from "~/editor/selection-store";
import { bindEditorSavers, useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

/** Client-only: `next/dynamic` with `ssr:false` steals refs, so load the panel
 *  (not the Remotion Player) dynamically and import Player normally inside. */
const PlayerPanel = dynamic(
  () =>
    import("~/editor/components/PlayerPanel").then((m) => m.PlayerPanel),
  { ssr: false },
);

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const editor = useEditor.getState();
      const selection = useSelection.getState();
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void editor.save();
      } else if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
      } else if (e.key === "Escape") {
        e.preventDefault();
        selection.clearSelection();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (isTypingTarget(e.target)) return;
        if (editor.deleteSelection()) e.preventDefault();
      } else if (isTypingTarget(e.target)) {
        return;
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        togglePlayback();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        editor.seekBySeconds(e.shiftKey ? -0.1 : -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        editor.seekBySeconds(e.shiftKey ? 0.1 : 1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}

type Props = {
  projectId: string;
};

export function EditorShell({ projectId }: Props) {
  const hydrateFromServer = useEditor((s) => s.hydrateFromServer);
  const loadState = useEditor((s) => s.loadState);
  const title = useEditor((s) => s.title);
  const dirty = useEditor((s) => s.configDirty || s.transcriptsDirty);
  const error = useEditor((s) => s.error);

  const updateConfig = api.project.updateConfig.useMutation();
  const updateTranscriptWords =
    api.project.updateTranscriptWords.useMutation();

  const projectQuery = api.project.byId.useQuery(
    { id: projectId },
    { enabled: projectId.length > 0 },
  );

  useGlobalShortcuts();

  useEffect(() => {
    bindEditorSavers({
      updateConfig: (input) => updateConfig.mutateAsync(input),
      updateTranscriptWords: (input) =>
        updateTranscriptWords.mutateAsync(input),
    });
  }, [updateConfig, updateTranscriptWords]);

  useEffect(() => {
    const data = projectQuery.data;
    if (!data) return;
    if (data.status !== "ready" && data.status !== "exporting") return;

    // Don't clobber in-progress local edits when react-query refetches.
    const current = useEditor.getState();
    if (
      current.loadState === "ready" &&
      current.projectId === data.id &&
      (current.configDirty || current.transcriptsDirty || current.saving)
    ) {
      return;
    }
    const configUpdatedAt = data.configUpdatedAt?.toISOString() ?? null;
    if (
      current.loadState === "ready" &&
      current.projectId === data.id &&
      current.configUpdatedAt === configUpdatedAt
    ) {
      return;
    }

    hydrateFromServer({
      id: data.id,
      title: data.title,
      status: data.status,
      config: data.config,
      configUpdatedAt,
      assets: data.assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        playbackUrl: a.playbackUrl,
        durationSec: a.durationSec,
        originalFilename: a.originalFilename,
        sortOrder: a.sortOrder,
      })),
      transcripts: data.assets.map((a) => ({
        assetId: a.id,
        words: a.transcript?.words ?? [],
      })),
    });
  }, [projectQuery.data, hydrateFromServer]);

  useEffect(() => {
    const label = title || "Editor";
    document.title = `${dirty ? "● " : ""}${label} · Talking Head`;
  }, [title, dirty]);

  if (projectQuery.isLoading || loadState === "loading") {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading editor…
      </div>
    );
  }

  const project = projectQuery.data;
  if (project === null || project === undefined) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">
          {projectQuery.isError ? "Failed to load project." : "Project not found."}
        </p>
        <Link href="/projects" className="text-sm text-primary underline">
          Back to projects
        </Link>
      </div>
    );
  }

  if (project.status === "processing" || project.status === "failed") {
    return null; // parent page handles status UI
  }

  return (
    <div
      className={cn(
        "relative grid h-dvh min-h-0 w-full max-w-[100vw] overflow-hidden bg-background text-foreground",
        "grid-rows-[auto_1fr_320px]",
      )}
    >
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-panel px-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/projects"
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            ← Projects
          </Link>
          {project.status === "exporting" ? (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
              exporting
            </span>
          ) : null}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Space play · Esc deselect · ⌘Z undo · ⌘S save
        </div>
      </header>

      {error ? (
        <div className="pointer-events-none absolute left-0 right-0 top-11 z-20 px-3 py-2">
          <div className="pointer-events-auto rounded-md bg-red-950 px-3 py-2 text-sm text-red-200 shadow-lg">
            {error}
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 min-w-0 grid-cols-[200px_minmax(0,1fr)_280px] overflow-hidden border-b border-border">
        <AssetsPanel />
        <TranscriptPanel />
        <PlayerPanel />
      </div>

      <Timeline />
    </div>
  );
}
