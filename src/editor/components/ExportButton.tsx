import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { useEditor } from "~/editor/store";
import { api } from "~/utils/api";

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
  const hasExport = Boolean(
    progressQuery.data?.exportS3Key ?? projectQuery.data?.exportS3Key,
  );

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
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${projectId}.mp4`;
    a.rel = "noopener";
    a.target = "_blank";
    a.click();
  };

  return (
    <div className="flex items-center gap-2">
      {exporting ? (
        <span className="text-[11px] text-muted-foreground">
          Rendering… {pct}%
        </span>
      ) : null}
      {error && !exporting ? (
        <span
          className="max-w-50 truncate text-[11px] text-red-300"
          title={error}
        >
          {error}
        </span>
      ) : null}
      {hasExport && downloadUrl && !exporting ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDownload}
        >
          Download
        </Button>
      ) : null}
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={exporting}
        onClick={() => void onExport()}
      >
        {exporting ? "Exporting…" : "Export"}
      </Button>
    </div>
  );
}
