import { FileVideo, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button, buttonVariants } from '~/components/ui/button';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '~/components/ui/dialog';
import { probeVideoFile } from '~/editor/lib/probe-media';
import { cn } from '~/lib/utils';
import { api } from '~/utils/api';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function putToPresignedUrl(
  file: File,
  uploadUrl: string,
  contentType: string,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!response.ok) {
    throw new Error(
      `Upload failed for ${file.name} (${response.status} ${response.statusText})`,
    );
  }
}

export function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "finalizing">(
    "idle",
  );

  const utils = api.useUtils();
  const createStart = api.project.createStart.useMutation();
  const createFinalize = api.project.createFinalize.useMutation();

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setError(null);
      setPhase("idle");
    }
  }, [open]);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => {
      const seen = new Set(
        prev.map((f) => `${f.name}:${f.size}:${f.lastModified}`),
      );
      const next = [...prev];
      for (const file of accepted) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          next.push(file);
        }
      }
      return next;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } =
    useDropzone({
      onDrop,
      accept: { "video/*": [".mp4", ".mov", ".webm", ".m4v"] },
      multiple: true,
      noClick: true,
      noKeyboard: true,
      disabled: phase !== "idle",
    });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const busy = phase !== "idle";

  const handleCreate = async () => {
    if (files.length === 0 || busy) return;
    setError(null);
    setPhase("uploading");

    try {
      const probed = await Promise.all(
        files.map(async (file) => {
          const meta = await probeVideoFile(file);
          return { file, meta };
        }),
      );

      const { projectId, uploads } = await createStart.mutateAsync({
        files: probed.map(({ file, meta }) => ({
          filename: file.name,
          contentType: file.type || "video/mp4",
          size: file.size,
          width: meta.width,
          height: meta.height,
          durationSec: meta.durationSec!,
        })),
      });

      await Promise.all(
        uploads.map(async (upload, index) => {
          const file = probed[index]?.file;
          if (!file) {
            throw new Error("File/upload mismatch");
          }
          await putToPresignedUrl(file, upload.uploadUrl, upload.contentType);
        }),
      );

      setPhase("finalizing");
      await createFinalize.mutateAsync({ projectId });
      await utils.project.list.invalidate();
      onCreated?.(projectId);
      onClose();
    } catch (err) {
      let message = "Could not create project";
      if (err instanceof Error) {
        message = err.message;
        // tRPC client errors often nest the server message
        const data = (err as { data?: { message?: string }; shape?: { message?: string } });
        if (data.shape?.message) message = data.shape.message;
        else if (data.data?.message) message = data.data.message;
      }
      setError(message);
      setPhase("idle");
      void utils.project.list.invalidate();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            New project
          </DialogTitle>
          <DialogDescription>
            Drop one or more A-roll videos. We&apos;ll upload, transcribe, and
            seed edits automatically.
          </DialogDescription>
        </DialogHeader>

        <div
          {...getRootProps()}
          className={cn(
            "flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/40",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <input {...getInputProps()} />
          <p className="text-sm font-medium text-foreground">
            {isDragActive ? "Drop videos to add them" : "Drag videos here"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, MOV — A-roll only
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-5"
            onClick={openFilePicker}
            disabled={busy}
          >
            Choose files
          </Button>
        </div>

        {files.length > 0 ? (
          <ul className="max-h-40 space-y-2 overflow-y-auto">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
                <FileVideo className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
                {!busy ? (
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon-xs" }),
                    )}
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeFile(index)}
                  >
                    <X />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            disabled={files.length === 0 || busy}
            onClick={() => {
              void handleCreate();
            }}
          >
            {phase === "uploading"
              ? "Uploading…"
              : phase === "finalizing"
                ? "Starting…"
                : `Create project${files.length > 0 ? ` (${files.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
