import { Upload } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import {
  LANDING_CREATE_LIMITS_HINT,
  LANDING_CREATE_MAX_BYTES,
} from "~/domain/create-limits";
import { cn } from "~/lib/utils";

import type { LandingTrialPhase } from "~/components/landing/use-landing-trial";

export function LandingDropZone({
  phase,
  disabled,
  acceptFiles,
  onAccepted,
  tone = "hero",
  className,
}: {
  phase: LandingTrialPhase;
  disabled: boolean;
  acceptFiles: (files: File[]) => void;
  onAccepted?: () => void;
  tone?: "hero" | "cta";
  className?: string;
}) {
  const { getRootProps, getInputProps, isDragAccept, isDragReject } =
    useDropzone({
      onDrop: (files) => {
        if (files.length === 0) return;
        onAccepted?.();
        acceptFiles(files);
      },
      accept: { "video/*": [".mp4", ".mov", ".webm", ".m4v"] },
      multiple: false,
      maxSize: LANDING_CREATE_MAX_BYTES,
      disabled,
      noClick: false,
      noKeyboard: false,
      onDropRejected: (rejections) => {
        const tooBig = rejections.some((r) =>
          r.errors.some((e) => e.code === "file-too-large"),
        );
        toast.error(
          tooBig
            ? `Each video must be 250 MB or smaller.`
            : `Drop one talking-head video (${LANDING_CREATE_LIMITS_HINT}).`,
        );
      },
    });
  const failed = phase === "failed";
  const cta = tone === "cta";

  return (
    <div
      {...getRootProps()}
      className={cn(
        "w-fit cursor-pointer rounded-[20px] border-2 border-dashed px-5 py-4 shadow-[4px_4px_0_#000] transition-colors",
        cta ? "text-[#450E16]" : "text-[#F5F9CE]",
        isDragAccept &&
          (cta
            ? "border-[#450E16] bg-[#FFA102]/40"
            : "border-[#FFA102] bg-[#FFA102]/15"),
        isDragReject && "border-[#450E16] bg-[#450E16]/15",
        !isDragAccept &&
          !isDragReject &&
          (cta
            ? "border-[#450E16]/45 bg-[#F5F9CE]/20 hover:border-[#450E16] hover:bg-[#FFA102]/25"
            : "border-[#F5F9CE]/40 bg-[#F5F9CE]/5 hover:border-[#FFA102] hover:bg-[#FFA102]/10"),
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input {...getInputProps()} />
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full bg-[#FFA102] text-[#450E16]",
          )}
        >
          <Upload className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 text-left">
          <p className="text-base font-semibold">
            {failed
              ? "Try another video"
              : isDragAccept
                ? "Drop to start"
                : "Upload and Try It For Free"}
          </p>
          <p
            className={cn(
              "ember-mono mt-1 text-[10px] tracking-[.12em] uppercase",
              cta ? "text-[#450E16]/55" : "text-[#F5F9CE]/60",
            )}
          >
            No login required
          </p>
        </div>
      </div>
    </div>
  );
}
