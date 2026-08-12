import { ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useEditor } from "~/editor/store";
import { api } from "~/utils/api";

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_blank";
  a.click();
}

function formatSlot(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function platformLabel(id: string) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function ExportButton() {
  const projectId = useEditor((s) => s.projectId);
  const status = useEditor((s) => s.status);
  const dirty = useEditor((s) => s.configDirty || s.transcriptsDirty);
  const save = useEditor((s) => s.save);

  const [error, setError] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);

  const utils = api.useUtils();
  const projectQuery = api.project.byId.useQuery(
    { id: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );
  const entryQuery = api.schedule.entryForProject.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );

  const exporting = status === "exporting" || localBusy;

  const progressQuery = api.project.exportProgress.useQuery(
    { id: projectId ?? "" },
    {
      enabled: Boolean(projectId) && exporting,
      refetchInterval: exporting ? 2000 : false,
    },
  );

  const exportMutation = api.project.export.useMutation({
    onSuccess: async () => {
      useEditor.setState({ status: "exporting" });
      await utils.project.byId.invalidate({ id: projectId ?? "" });
      await utils.project.exportProgress.invalidate({ id: projectId ?? "" });
    },
    onError: (err) => {
      setError(err.message);
      setLocalBusy(false);
    },
  });

  const addSchedule = api.schedule.addEntry.useMutation({
    onSuccess: async () => {
      setError(null);
      await utils.schedule.entryForProject.invalidate({
        projectId: projectId ?? "",
      });
      await utils.schedule.queue.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  useEffect(() => {
    const progress = progressQuery.data;
    if (!progress) return;
    if (progress.status !== "exporting") {
      setLocalBusy(false);
      useEditor.setState({ status: progress.status });
      void utils.project.byId.invalidate({ id: projectId ?? "" });
      if (progress.failureReason) {
        setError(progress.failureReason);
      }
    }
  }, [progressQuery.data, projectId, utils.project.byId]);

  if (!projectId) return null;

  const downloadUrl =
    progressQuery.data?.downloadUrl ?? projectQuery.data?.downloadUrl ?? null;
  const coverDownloadUrl =
    progressQuery.data?.coverDownloadUrl ??
    projectQuery.data?.coverDownloadUrl ??
    null;
  const hasExport = Boolean(
    progressQuery.data?.exportS3Key ?? projectQuery.data?.exportS3Key,
  );
  const hasCover = Boolean(projectQuery.data?.coverS3Key);
  const entry = entryQuery.data;
  const alreadyQueued = Boolean(entry);
  const canDownload = Boolean(hasExport && downloadUrl);
  const canSchedule = hasExport && hasCover && !alreadyQueued;

  const pct = Math.round((progressQuery.data?.progress ?? 0) * 100);

  const onExport = async () => {
    setError(null);
    setLocalBusy(true);
    try {
      if (dirty) await save();
      await exportMutation.mutateAsync({ id: projectId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setLocalBusy(false);
    }
  };

  const onDownload = () => {
    if (!downloadUrl) return;
    triggerDownload(downloadUrl, `${projectId}.mp4`);
    if (coverDownloadUrl) {
      triggerDownload(coverDownloadUrl, `${projectId}-cover.jpg`);
    }
  };

  const onAddToSchedule = () => {
    setError(null);
    addSchedule.mutate({ projectId });
  };

  const scheduleDisabledReason = alreadyQueued
    ? undefined
    : !hasCover
      ? "Cover required"
      : undefined;

  const primary = (
    <Button
      type="button"
      variant="default"
      size="sm"
      disabled={exporting}
      onClick={() => void onExport()}
    >
      {exporting ? `Exporting… ${pct}%` : "Export"}
    </Button>
  );

  return (
    <div className="flex items-center gap-2">
      {error && !exporting ? (
        <span
          className="max-w-50 truncate text-[11px] text-red-300"
          title={error}
        >
          {error}
        </span>
      ) : null}
      {hasExport ? (
        <ButtonGroup>
          {primary}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="default"
                  size="icon-sm"
                  aria-label="Download and schedule"
                  className="before:bg-primary-foreground/30 relative before:absolute before:inset-y-1.5 before:left-0 before:w-px"
                />
              }
            >
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem disabled={!canDownload} onClick={onDownload}>
                Download
              </DropdownMenuItem>
              {alreadyQueued ? (
                <DropdownMenuItem disabled>
                  On schedule
                  {entry?.scheduledAt ? (
                    <DropdownMenuShortcut>
                      {formatSlot(entry.scheduledAt)}
                    </DropdownMenuShortcut>
                  ) : null}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={!canSchedule || addSchedule.isPending}
                  onClick={onAddToSchedule}
                >
                  {addSchedule.isPending ? "Adding…" : "Add to schedule"}
                  {scheduleDisabledReason ? (
                    <DropdownMenuShortcut>
                      {scheduleDisabledReason}
                    </DropdownMenuShortcut>
                  ) : null}
                </DropdownMenuItem>
              )}
              {entry?.platforms.length ? (
                <>
                  <DropdownMenuSeparator />
                  {entry.platforms.map((p) =>
                    p.postUrl ? (
                      <DropdownMenuLinkItem
                        key={p.platform}
                        href={p.postUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {platformLabel(p.platform)}
                        <ExternalLink className="text-muted-foreground ml-auto size-3.5" />
                      </DropdownMenuLinkItem>
                    ) : (
                      <DropdownMenuItem key={p.platform} disabled>
                        {platformLabel(p.platform)}
                        <DropdownMenuShortcut>{p.status}</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    ),
                  )}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      ) : (
        primary
      )}
    </div>
  );
}
