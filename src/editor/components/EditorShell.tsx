import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";

import { AiAssistButton } from "~/editor/components/AiAssistButton";
import { AssetsPanel } from "~/editor/components/assets/AssetsPanel";
import { ExportButton } from "~/editor/components/ExportButton";
import { Timeline } from "~/editor/components/timeline/Timeline";
import { TranscriptPanel } from "~/editor/components/transcript/TranscriptPanel";
import { togglePlayback } from "~/editor/lib/player-bridge";
import { useSelection } from "~/editor/selection-store";
import { bindEditorSavers, useEditor } from "~/editor/store";
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
        // Capture-phase stop so focused words (role=button) don't also
        // activate and seek back to word.start.
        e.preventDefault();
        e.stopPropagation();
        togglePlayback();
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
      // Still merge global libraries if they arrived after initial hydrate.
      const extras = globalAssetsQuery.data;
      if (extras?.length) {
        useEditor.getState().addAssets(extras);
      }
      return;
    }

    const projectAssets = data.assets;
    const globalAssets = globalAssetsQuery.data ?? [];
    const byId = new Map(
      [...projectAssets, ...globalAssets].map((a) => [a.id, a]),
    );

    hydrateFromServer({
      id: data.id,
      title: data.title,
      status: data.status,
      config: data.config,
      configUpdatedAt,
      assets: [...byId.values()],
      // Only assets that have a transcript row — b-roll/etc. must not be
      // hydrated as empty maps or autosave will 404 on updateTranscriptWords.
      transcripts: data.assets.flatMap((a) =>
        a.transcript
          ? [{ assetId: a.id, words: a.transcript.words ?? [] }]
          : [],
      ),
    });
  }, [projectQuery.data, globalAssetsQuery.data, hydrateFromServer]);

  useEffect(() => {
    const label = title || "Editor";
    document.title = `${dirty ? "● " : ""}${label} · Talking Head`;
  }, [title, dirty]);

  if (projectQuery.isLoading || loadState === "loading") {
    return (
      <div className="text-muted-foreground flex h-dvh items-center justify-center text-sm">
        Loading editor…
      </div>
    );
  }

  const project = projectQuery.data;
  if (project === null || project === undefined) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3">
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
        "bg-background text-foreground relative grid h-dvh min-h-0 w-full max-w-[100vw] overflow-hidden",
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
          {project.status === "exporting" ? (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
              exporting
            </span>
          ) : null}
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
