import { ChevronDown, CloudUpload, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
import { canUseSchedule } from "~/domain/schedule/schedule";
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
  const { data: session } = useSession();
  const showSchedule = canUseSchedule(session?.user?.email);
  const projectId = useEditor((s) => s.projectId);
  const status = useEditor((s) => s.status);
  const dirty = useEditor((s) => s.configDirty || s.transcriptsDirty);
  const save = useEditor((s) => s.save);

  const [localBusy, setLocalBusy] = useState(false);
  const toastedExportFailureRef = useRef<string | null>(null);

  const utils = api.useUtils();
  const projectQuery = api.project.byId.useQuery(
    { id: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );
  const entryQuery = api.schedule.entryForProject.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) && showSchedule },
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
    onError: () => {
      setLocalBusy(false);
    },
  });

  const addSchedule = api.schedule.addEntry.useMutation({
    onSuccess: async () => {
      await utils.schedule.entryForProject.invalidate({
        projectId: projectId ?? "",
      });
      await utils.schedule.queue.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    const progress = progressQuery.data;
    if (!progress) return;
    if (progress.status !== "exporting") {
      setLocalBusy(false);
      useEditor.setState({ status: progress.status });
      void utils.project.byId.invalidate({ id: projectId ?? "" });
      if (
        progress.failureReason &&
        toastedExportFailureRef.current !== progress.failureReason
      ) {
        toastedExportFailureRef.current = progress.failureReason;
        toast.error(progress.failureReason);
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
    toastedExportFailureRef.current = null;
    setLocalBusy(true);
    try {
      if (dirty) await save();
      await exportMutation.mutateAsync({ id: projectId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
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
      variant="ember"
      size="sm"
      disabled={exporting}
      onClick={() => void onExport()}
      className="h-7 rounded-[10px] px-2.5 text-xs"
    >
      <CloudUpload className="size-3.5" />
      {exporting ? `Exporting… ${pct}%` : "Export video"}
    </Button>
  );

  return (
    <div className="flex items-center gap-2">
      {hasExport ? (
        <ButtonGroup>
          {primary}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ember"
                  size="icon-sm"
                  aria-label={
                    showSchedule ? "Download and schedule" : "Download"
                  }
                  className="relative rounded-[10px] before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-[#450E16]/30"
                />
              }
            >
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-48 rounded-[12px] border-2 border-[#450E16] bg-[#F5F9CE] text-[#450E16] shadow-[4px_4px_0_#450E16] ring-0"
            >
              <DropdownMenuItem disabled={!canDownload} onClick={onDownload}>
                Download
              </DropdownMenuItem>
              {showSchedule && alreadyQueued ? (
                <DropdownMenuItem disabled>
                  On schedule
                  {entry?.scheduledAt ? (
                    <DropdownMenuShortcut>
                      {formatSlot(entry.scheduledAt)}
                    </DropdownMenuShortcut>
                  ) : null}
                </DropdownMenuItem>
              ) : null}
              {showSchedule && !alreadyQueued ? (
                <DropdownMenuItem
                  disabled={!canSchedule || addSchedule.isPending}
                  onClick={onAddToSchedule}
                >
                  {addSchedule.isPending ? "Adding…" : "Schedule"}
                  {scheduleDisabledReason ? (
                    <DropdownMenuShortcut>
                      {scheduleDisabledReason}
                    </DropdownMenuShortcut>
                  ) : null}
                </DropdownMenuItem>
              ) : null}
              {showSchedule && entry?.platforms.length ? (
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
