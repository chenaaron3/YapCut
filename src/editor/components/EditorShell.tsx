import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";

import { EditorLoading, useEditorLock } from "~/components/layout/EditorLoading";
import { ProjectsBackLink } from "~/components/layout/ProjectsBackLink";

import {
  isEditorProjectStatus,
  isProjectStatus,
} from "~/domain/project-status";
import { AssetsPanel } from "~/editor/components/assets/AssetsPanel";
import { ExportButton } from "~/editor/components/ExportButton";
import { ProjectTitleField } from "~/editor/components/ProjectTitleField";
import { Timeline } from "~/editor/components/timeline/Timeline";
import { TranscriptPanel } from "~/editor/components/transcript/TranscriptPanel";
import { hydrateInputFromProject } from "~/editor/lib/hydrate-project";
import { togglePlayback } from "~/editor/lib/player-bridge";
import { applyWordSelectionHotkey } from "~/editor/lib/word-hotkeys";
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
      className="ember-mono hidden h-7 items-center gap-1.5 rounded-full border-2 border-[#450E16] bg-[#F5F9CE] px-2.5 text-[10px] font-medium tracking-[.08em] text-[#450E16] uppercase lg:inline-flex"
      title={label}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          saving ? "bg-[#75677F]" : dirty ? "bg-[#FFA102]" : "bg-sfx",
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
      } else if (
        !meta &&
        !e.repeat &&
        applyWordSelectionHotkey(e.key.toLowerCase())
      ) {
        e.preventDefault();
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
  const storeProjectId = useEditor((s) => s.projectId);
  const title = useEditor((s) => s.title);
  const dirty = useEditor((s) => s.configDirty || s.transcriptsDirty);

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
    if (!isProjectStatus(data.status) || !isEditorProjectStatus(data.status)) {
      return;
    }

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
    document.title = `${dirty ? "● " : ""}${label} · YapCut`;
  }, [title, dirty]);

  useEditorLock();

  const awaitingEditor =
    projectId.length === 0 ||
    projectQuery.isLoading ||
    loadState === "loading" ||
    (projectQuery.data != null &&
      isEditorProjectStatus(projectQuery.data.status) &&
      storeProjectId !== projectId);

  if (awaitingEditor) {
    return <EditorLoading />;
  }

  const project = projectQuery.data;
  if (project === null || project === undefined) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#12141A]">
        <p className="text-sm text-[#C4B8A8]">
          {projectQuery.isError
            ? "Failed to load project."
            : "Project not found."}
        </p>
        <Link
          href="/projects"
          className="text-sm text-[#F5F9CE] underline decoration-[#FFA102] decoration-2 underline-offset-4"
        >
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
        "grid-rows-[auto_minmax(0,1fr)]",
        "selection:bg-[#FFA102] selection:text-[#450E16]",
      )}
    >
      <header className="relative flex h-11 shrink-0 items-center justify-between border-b border-[#450E16]/25 bg-[#BC2D29] px-3 text-[#F5F9CE]">
        <div className="flex min-w-0 items-center gap-3">
          <ProjectsBackLink />
        </div>
        <ProjectTitleField className="absolute left-1/2 hidden max-w-[min(40vw,320px)] -translate-x-1/2 lg:inline-grid" />
        <div className="flex items-center gap-2">
          <SaveStatusBadge />
          <ExportButton />
        </div>
      </header>

      <div className="@container-size grid min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-1">
        <div className="border-border order-2 grid min-h-0 min-w-0 grid-rows-1 lg:order-1 lg:grid-rows-[minmax(0,1fr)_auto] lg:border-r">
          <div className="grid min-h-0 min-w-0 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
            <AssetsPanel />
            <TranscriptPanel />
          </div>
          <Timeline />
        </div>
        <PlayerPanel />
      </div>
    </div>
  );
}
