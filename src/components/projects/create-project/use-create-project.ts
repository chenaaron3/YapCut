import { useEffect, useState } from "react";

import { putToPresignedUrl } from "~/components/projects/create-project/upload";
import { assertCreateBatch } from "~/domain/create-limits";
import { probeVideoFile } from "~/editor/lib/probe-media";
import { api } from "~/utils/api";

import type {
  ClipItem,
  CreatePhase,
} from "~/components/projects/create-project/types";
import type { ProbedMedia } from "~/editor/lib/probe-media";

export function useCreateProject(options: {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}) {
  const { open, onClose, onCreated } = options;
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<CreatePhase>("idle");
  const utils = api.useUtils();
  const createStart = api.project.createStart.useMutation();
  const createFinalize = api.project.createFinalize.useMutation();
  const busy = phase !== "idle";

  useEffect(() => {
    if (open) return;
    setError(null);
    setPhase("idle");
  }, [open]);

  const handleCreate = async (clips: ClipItem[]) => {
    if (clips.length === 0 || busy) return;
    setError(null);
    setPhase("uploading");

    try {
      const probed = await Promise.all(
        clips.map(async (clip) => {
          if (
            clip.durationSec != null &&
            clip.width != null &&
            clip.height != null
          ) {
            return {
              file: clip.file,
              meta: {
                width: clip.width,
                height: clip.height,
                durationSec: clip.durationSec,
              } satisfies ProbedMedia,
            };
          }
          return { file: clip.file, meta: await probeVideoFile(clip.file) };
        }),
      );

      const files = probed.map(({ file, meta }) => ({
        filename: file.name,
        contentType: file.type || "video/mp4",
        size: file.size,
        width: meta.width,
        height: meta.height,
        durationSec: meta.durationSec!,
      }));
      assertCreateBatch(
        files.map((file) => ({
          filename: file.filename,
          size: file.size,
          durationSec: file.durationSec,
          width: file.width,
          height: file.height,
        })),
      );

      // Array order is merge order: clip 1 is first, last clip is last.
      const { projectId, uploads } = await createStart.mutateAsync({
        files,
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
        const data = err as {
          data?: { message?: string };
          shape?: { message?: string };
        };
        if (data.shape?.message) message = data.shape.message;
        else if (data.data?.message) message = data.data.message;
      }
      setError(message);
      setPhase("idle");
      void utils.project.list.invalidate();
    }
  };

  return { error, phase, busy, handleCreate };
}
