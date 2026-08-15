import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";

import { AiAssistButton } from "~/editor/components/AiAssistButton";
import { AssetsPanel } from "~/editor/components/assets/AssetsPanel";
import { ExportButton } from "~/editor/components/ExportButton";
import { Timeline } from "~/editor/components/timeline/Timeline";
import { TranscriptPanel } from "~/editor/components/transcript/TranscriptPanel";
import { hydrateInputFromProject } from "~/editor/lib/hydrate-project";
import { togglePlayback } from "~/editor/lib/player-bridge";
import { useSelection } from "~/editor/selection-store";
import { bindEditorSavers, useEditor } from "~/editor/store";
import { useTranscriptUi } from "~/editor/transcript-ui-store";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

function SaveStatusBadge() {
  const dirty = useEditor((s) => s.configDirty || s.transcriptsDirty);
  const saving = useEditor((s) => s.saving);
  const label = saving ? "Saving…" : dirty ? "Unsaved" : "Saved";
  return (
    <span
      className="border-border bg-panel-2 text-muted-foreground inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px]"
      title={label}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          saving ? "bg-muted-foreground" : dirty ? "bg-amber-400" : "bg-sfx",
        )}
      />
      {label}
    </span>
  );
}

/** Client-only: `next/dynamic` with `ssr:false` steals refs, so load the panel
 *  (not the Remotion Player) dynamically and import Player normally inside. */
const PlayerPanel = dynamic(
  () => import("~/editor/components/PlayerPanel").then((m) => m.PlayerPanel),
  { ssr: false },
);

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

function isSpaceKey(e: KeyboardEvent) {
  return e.key === " " || e.code === "Space";
}

function useGlobalShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
        const ui = useTranscriptUi.getState();
        if (ui.pendingBrollPlace) {
          ui.clearPendingBrollPlace();
          return;
        }
        selection.clearSelection();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (isTypingTarget(e.target)) return;
        if (editor.deleteSelection()) e.preventDefault();
      } else if (isTypingTarget(e.target)) {
        return;
      } else if (isSpaceKey(e)) {
        // Capture-phase stop so focused buttons (play, templates, words)
        // don't also activate on keyup and undo this toggle.
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        const togglePreview =
          useTranscriptUi.getState().toggleBrollPreviewPlayback;
        if (togglePreview) {
          togglePreview();
          return;
        }
        togglePlayback(e);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (
          !e.shiftKey &&
          selection.selection?.kind === "word" &&
          editor.seekAdjacentWord(-1)
        ) {
          return;
        }
        editor.seekBySeconds(e.shiftKey ? -0.1 : -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (
          !e.shiftKey &&
          selection.selection?.kind === "word" &&
          editor.seekAdjacentWord(1)
        ) {
          return;
        }
        editor.seekBySeconds(e.shiftKey ? 0.1 : 1);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!isSpaceKey(e) || isTypingTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
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
  const updateTranscriptWords = api.project.updateTranscriptWords.useMutation();

  const projectQuery = api.project.byId.useQuery(
    { id: projectId },
    {
      enabled: projectId.length > 0,
      refetchInterval: (query) =>
        query.state.data?.status === "exporting" ? 2000 : false,
    },
  );
  const globalAssetsQuery = api.project.listGlobalAssets.useQuery(undefined, {
    staleTime: 60_000,
  });

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

    const current = useEditor.getState();
    const extras = globalAssetsQuery.data ?? [];
    const alreadyOpen =
      current.loadState === "ready" && current.projectId === data.id;

    // Store is the working copy after first open. Query refetches may patch
    // server-owned status and merge late library assets — never replace config.
    if (alreadyOpen) {
      if (extras.length > 0) {
        const have = new Set(current.assets.map((asset) => asset.id));
        if (extras.some((asset) => !have.has(asset.id))) {
          current.addAssets(extras);
        }
      }
      if (current.status !== data.status) {
        useEditor.setState({ status: data.status });
      }
      return;
    }

    hydrateFromServer(hydrateInputFromProject(data, extras));
  }, [projectQuery.data, globalAssetsQuery.data, hydrateFromServer]);

  useEffect(() => {
    const flush = () => {
      void useEditor.getState().save();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  useEffect(() => {
    const label = title || "Editor";
    document.title = `${dirty ? "● " : ""}${label} · Talking Head`;
  }, [title, dirty]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("editor-lock");
    return () => root.classList.remove("editor-lock");
  }, []);

  if (projectQuery.isLoading || loadState === "loading") {
    return (
      <div className="text-muted-foreground flex h-screen items-center justify-center text-sm">
        Loading editor…
      </div>
    );
  }

  const project = projectQuery.data;
  if (project === null || project === undefined) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground text-sm">
          {projectQuery.isError
            ? "Failed to load project."
            : "Project not found."}
        </p>
        <Link href="/projects" className="text-primary text-sm underline">
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
        "bg-background text-foreground fixed inset-0 grid h-screen min-h-0 w-full overflow-hidden overscroll-none",
        "grid-rows-[auto_1fr_320px]",
      )}
    >
      <header className="border-border bg-panel flex h-11 shrink-0 items-center justify-between border-b px-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/projects"
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
          >
            ← Projects
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <SaveStatusBadge />
          <AiAssistButton />
          <ExportButton />
        </div>
      </header>

      {error ? (
        <div className="pointer-events-none absolute top-11 right-0 left-0 z-20 px-3 py-2">
          <div className="pointer-events-auto rounded-md bg-red-950 px-3 py-2 text-sm text-red-200 shadow-lg">
            {error}
          </div>
        </div>
      ) : null}

      <div className="border-border grid min-h-0 min-w-0 grid-cols-[200px_minmax(0,1fr)_280px] border-b">
        <AssetsPanel />
        <TranscriptPanel />
        <PlayerPanel />
      </div>

      <Timeline />
    </div>
  );
}
