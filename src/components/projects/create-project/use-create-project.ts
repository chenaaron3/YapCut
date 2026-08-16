import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  isAbortError,
  putToPresignedUrl,
} from "~/components/projects/create-project/upload";
import { api } from "~/utils/api";

import type {
  ClipItem,
  ClipUploadPatch,
  CreatePhase,
  CreateUploader,
} from "~/components/projects/create-project/types";

function fileMeta(clip: ClipItem) {
  return {
    filename: clip.file.name,
    contentType: clip.file.type || "video/mp4",
    size: clip.file.size,
    width: clip.width!,
    height: clip.height!,
    durationSec: clip.durationSec!,
  };
}

function mutationMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const data = error as {
    data?: { message?: string };
    shape?: { message?: string };
  };
  return data.shape?.message ?? data.data?.message ?? error.message;
}

export function useCreateProject(options: {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}) {
  const { open, onClose, onCreated } = options;
  const [phase, setPhase] = useState<CreatePhase>("idle");
  const utils = api.useUtils();
  const createStart = api.project.createStart.useMutation();
  const createAddFiles = api.project.createAddFiles.useMutation();
  const createRemoveAsset = api.project.createRemoveAsset.useMutation();
  const createDiscard = api.project.createDiscard.useMutation();
  const createFinalize = api.project.createFinalize.useMutation();

  const projectIdRef = useRef<string | null>(null);
  const finalizedRef = useRef(false);
  const sessionRef = useRef(0);
  const startLockRef = useRef<Promise<unknown> | null>(null);
  const removedIdsRef = useRef(new Set<string>());
  const abortsRef = useRef(new Map<string, AbortController>());
  const waitersRef = useRef(new Map<string, Promise<void>>());

  const busy = phase === "finalizing";

  useEffect(() => {
    if (open) {
      sessionRef.current += 1;
      projectIdRef.current = null;
      finalizedRef.current = false;
      startLockRef.current = null;
      removedIdsRef.current = new Set();
      abortsRef.current = new Map();
      waitersRef.current = new Map();
      setPhase("idle");
      return;
    }

    const session = sessionRef.current;
    sessionRef.current += 1;
    const projectId = projectIdRef.current;
    const pendingStart = startLockRef.current;
    const finalized = finalizedRef.current;
    for (const controller of abortsRef.current.values()) controller.abort();
    abortsRef.current.clear();

    void (async () => {
      if (finalized) return;
      if (pendingStart) {
        await pendingStart.catch(() => undefined);
      }
      const id = projectId ?? projectIdRef.current;
      if (!id) return;
      try {
        await createDiscard.mutateAsync({ projectId: id });
      } catch {
        // Draft may already be gone (stale start discarded itself).
      }
      if (sessionRef.current === session + 1) {
        projectIdRef.current = null;
        startLockRef.current = null;
      }
    })();

    setPhase("idle");
    // Discard only when the modal closes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const presignClips = async (clips: ClipItem[]) => {
    const files = clips.map(fileMeta);
    if (!projectIdRef.current) {
      if (!startLockRef.current) {
        const session = sessionRef.current;
        const lock = createStart.mutateAsync({ files }).then((result) => {
          if (sessionRef.current !== session) {
            void createDiscard
              .mutateAsync({ projectId: result.projectId })
              .catch(() => undefined);
            return result.uploads;
          }
          projectIdRef.current = result.projectId;
          return result.uploads;
        });
        startLockRef.current = lock;
        try {
          const uploads = await lock;
          if (sessionRef.current !== session) {
            throw new Error("Upload cancelled");
          }
          return clips.map((clip, index) => ({
            clip,
            upload: uploads[index]!,
          }));
        } finally {
          if (startLockRef.current === lock) {
            startLockRef.current = null;
          }
        }
      }
      await startLockRef.current;
    }

    const projectId = projectIdRef.current;
    if (!projectId) {
      throw new Error("Could not start project upload");
    }
    const { uploads } = await createAddFiles.mutateAsync({ projectId, files });
    return clips.map((clip, index) => ({ clip, upload: uploads[index]! }));
  };

  const uploadClips = (
    clips: ClipItem[],
    update: (id: string, patch: ClipUploadPatch) => void,
  ) => {
    const work = (async () => {
      let pairs: Array<{
        clip: ClipItem;
        upload: { assetId: string; uploadUrl: string; contentType: string };
      }>;
      try {
        pairs = await presignClips(clips);
      } catch (err) {
        const message = mutationMessage(err, "Could not start upload");
        for (const clip of clips) {
          if (removedIdsRef.current.has(clip.id)) continue;
          update(clip.id, { uploadStatus: "error", uploadError: message });
        }
        toast.error(message);
        return;
      }

      await Promise.all(
        pairs.map(async ({ clip, upload }) => {
          if (removedIdsRef.current.has(clip.id)) {
            const projectId = projectIdRef.current;
            if (projectId) {
              await createRemoveAsset
                .mutateAsync({ projectId, assetId: upload.assetId })
                .catch(() => undefined);
            }
            return;
          }

          update(clip.id, {
            assetId: upload.assetId,
            uploadStatus: "uploading",
            uploadProgress: 0,
            uploadError: null,
          });

          const controller = new AbortController();
          abortsRef.current.set(clip.id, controller);
          try {
            await putToPresignedUrl(
              clip.file,
              upload.uploadUrl,
              upload.contentType,
              {
                signal: controller.signal,
                onProgress: (fraction) => {
                  update(clip.id, { uploadProgress: fraction });
                },
              },
            );
            if (removedIdsRef.current.has(clip.id)) {
              const projectId = projectIdRef.current;
              if (projectId) {
                await createRemoveAsset
                  .mutateAsync({ projectId, assetId: upload.assetId })
                  .catch(() => undefined);
              }
              return;
            }
            update(clip.id, {
              assetId: upload.assetId,
              uploadStatus: "done",
              uploadProgress: 1,
              uploadError: null,
            });
          } catch (err) {
            if (isAbortError(err) || removedIdsRef.current.has(clip.id)) {
              return;
            }
            const message = mutationMessage(err, "Upload failed");
            update(clip.id, {
              uploadStatus: "error",
              uploadError: message,
            });
            toast.error(`${clip.file.name}: ${message}`);
          } finally {
            abortsRef.current.delete(clip.id);
          }
        }),
      );
    })();

    for (const clip of clips) {
      waitersRef.current.set(clip.id, work);
    }
  };

  const removeClipAsset = (clip: ClipItem) => {
    removedIdsRef.current.add(clip.id);
    abortsRef.current.get(clip.id)?.abort();
    abortsRef.current.delete(clip.id);
    waitersRef.current.delete(clip.id);
    const projectId = projectIdRef.current;
    if (projectId && clip.assetId) {
      void createRemoveAsset
        .mutateAsync({ projectId, assetId: clip.assetId })
        .catch(() => undefined);
    }
  };

  const handleCreate = async (clips: ClipItem[]) => {
    if (clips.length === 0 || busy) return;
    setPhase("finalizing");

    try {
      await Promise.all([...waitersRef.current.values()]);
      const assetIds = clips
        .map((clip) => clip.assetId)
        .filter((id): id is string => id != null);
      if (assetIds.length !== clips.length) {
        throw new Error("Wait for every clip to finish uploading");
      }
      const projectId = projectIdRef.current;
      if (!projectId) {
        throw new Error("Could not create project");
      }
      await createFinalize.mutateAsync({ projectId, assetIds });
      finalizedRef.current = true;
      await utils.project.list.invalidate();
      onCreated?.(projectId);
      onClose();
    } catch (err) {
      const message = mutationMessage(err, "Could not create project");
      toast.error(message);
      setPhase("idle");
      void utils.project.list.invalidate();
    }
  };

  const uploaderRef = useRef<CreateUploader>({ uploadClips, removeClipAsset });
  uploaderRef.current = { uploadClips, removeClipAsset };
  const uploader = useMemo<CreateUploader>(
    () => ({
      uploadClips: (clips, update) =>
        uploaderRef.current.uploadClips(clips, update),
      removeClipAsset: (clip) => uploaderRef.current.removeClipAsset(clip),
    }),
    [],
  );

  return { phase, busy, handleCreate, uploader };
}
