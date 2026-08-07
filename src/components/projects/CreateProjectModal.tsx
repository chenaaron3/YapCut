import { FileVideo, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

import { Button, buttonVariants } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreateProjectModal({ open, onClose }: Props) {
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!open) setFiles([]);
  }, [open]);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}:${f.lastModified}`));
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
    });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            New project
          </DialogTitle>
          <DialogDescription>
            Drop one or more A-roll videos. Upload and transcription land in the
            next milestone.
          </DialogDescription>
        </DialogHeader>

        <div
          {...getRootProps()}
          className={cn(
            "flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/40",
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
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            disabled={files.length === 0}
            onClick={() => {
              /* Milestone 3: upload + create workflow */
            }}
          >
            Create project
            {files.length > 0 ? ` (${files.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
