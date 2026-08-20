import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import {
  fileKey,
  formatFromName,
} from "~/components/projects/create-project/format";
import {
  createFileLimit,
  summarizeCreateRejections,
  usedFromCreateFiles,
} from "~/domain/project/create-limits";
import { probeVideoFile } from "~/editor/lib/player/probe-media";

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type {
  ClipItem,
  CreateUploader,
} from "~/components/projects/create-project/types";
import type { CreateLimitCode, CreateMediaInput } from "~/domain/project/create-limits";

function revokeAll(items: ClipItem[]) {
  for (const clip of items) URL.revokeObjectURL(clip.previewUrl);
}

function toCreateMedia(clip: ClipItem): CreateMediaInput | null {
  if (clip.durationSec == null || clip.width == null || clip.height == null) {
    return null;
  }
  return {
    filename: clip.file.name,
    size: clip.file.size,
    durationSec: clip.durationSec,
    width: clip.width,
    height: clip.height,
  };
}

export function useCreateClips(
  open: boolean,
  busy = false,
  uploader?: CreateUploader,
) {
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [status, setStatus] = useState("Drop videos to start a sequence.");
  const [checking, setChecking] = useState(false);
  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  const draggingClip =
    draggingId == null
      ? null
      : (clips.find((clip) => clip.id === draggingId) ?? null);

  useEffect(() => {
    if (open) return;
    setClips((prev) => {
      revokeAll(prev);
      return [];
    });
    setActiveId(null);
    setDraggingId(null);
    setChecking(false);
    setStatus("Drop videos to start a sequence.");
  }, [open]);

  const appendFiles = useCallback(
    (accepted: File[]) => {
      if (checking) return;
      const incoming = [...accepted].reverse();
      if (incoming.length === 0) return;

      void (async () => {
        setChecking(true);
        try {
          const prev = clipsRef.current;
          const seen = new Set(prev.map((clip) => fileKey(clip.file)));
          const known = prev
            .map(toCreateMedia)
            .filter((item): item is CreateMediaInput => item != null);
          const used = usedFromCreateFiles(known);
          const additions: ClipItem[] = [];
          const rejected: Array<{ filename: string; code: CreateLimitCode }> =
            [];
          const duplicates: string[] = [];
          let unreadable = 0;

          for (const file of incoming) {
            const key = fileKey(file);
            if (seen.has(key)) {
              duplicates.push(file.name);
              continue;
            }
            seen.add(key);

            let meta: Awaited<ReturnType<typeof probeVideoFile>>;
            try {
              meta = await probeVideoFile(file);
            } catch {
              unreadable += 1;
              continue;
            }
            if (meta.durationSec == null) {
              unreadable += 1;
              continue;
            }

            const candidate: CreateMediaInput = {
              filename: file.name,
              size: file.size,
              durationSec: meta.durationSec,
              width: meta.width,
              height: meta.height,
            };
            const code = createFileLimit(candidate, used);
            if (code) {
              rejected.push({ filename: file.name, code });
              continue;
            }

            used.count += 1;
            used.bytes += file.size;
            used.durationSec += meta.durationSec;
            additions.push({
              id: crypto.randomUUID(),
              file,
              previewUrl: URL.createObjectURL(file),
              durationSec: meta.durationSec,
              width: meta.width,
              height: meta.height,
              format: formatFromName(file),
              assetId: null,
              uploadStatus: "queued",
              uploadProgress: 0,
              uploadError: null,
            });
          }

          if (additions.length > 0) {
            const next = [...prev, ...additions];
            clipsRef.current = next;
            setClips(next);
            setActiveId((current) => current ?? additions[0]!.id);
            setStatus(
              `${additions.length} video${additions.length === 1 ? "" : "s"} added to the end of the sequence.`,
            );
            uploader?.uploadClips(additions, (id, patch) => {
              setClips((current) => {
                const updated = current.map((clip) =>
                  clip.id === id ? { ...clip, ...patch } : clip,
                );
                clipsRef.current = updated;
                return updated;
              });
            });
          }

          if (rejected.length > 0) {
            toast.error(summarizeCreateRejections(rejected));
          }
          if (unreadable > 0) {
            toast.error(
              unreadable === 1
                ? "Couldn’t read one video."
                : `Couldn’t read ${unreadable} videos.`,
            );
          }
          if (duplicates.length > 0) {
            toast.error(
              duplicates.length === 1
                ? `${duplicates[0]} is already in the sequence.`
                : `${duplicates.length} videos are already in the sequence.`,
            );
          }
        } finally {
          setChecking(false);
        }
      })();
    },
    [checking, uploader],
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      appendFiles(accepted);
    },
    [appendFiles],
  );

  const dropzone = useDropzone({
    onDrop,
    accept: { "video/*": [".mp4", ".mov", ".webm", ".m4v"] },
    multiple: true,
    disabled: busy || checking,
    noClick: true,
    noKeyboard: true,
  });

  useEffect(() => {
    if (clips.length === 0) {
      if (activeId != null) setActiveId(null);
      return;
    }
    if (!activeId || !clips.some((clip) => clip.id === activeId)) {
      setActiveId(clips[0]!.id);
    }
  }, [activeId, clips]);

  const moveClip = (id: string, direction: -1 | 1) => {
    setClips((prev) => {
      const from = prev.findIndex((clip) => clip.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = arrayMove(prev, from, to);
      const moved = next[to];
      if (moved) {
        setStatus(
          `Clip ${to + 1}. ${moved.file.name} is now in the merge sequence.`,
        );
      }
      return next;
    });
  };

  const removeClip = (id: string) => {
    setClips((prev) => {
      const removedIndex = prev.findIndex((clip) => clip.id === id);
      const removed = prev[removedIndex];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        uploader?.removeClipAsset(removed);
      }
      const next = prev.filter((clip) => clip.id !== id);
      clipsRef.current = next;
      setActiveId((current) => {
        if (current !== id) return current;
        return next[Math.min(removedIndex, next.length - 1)]?.id ?? null;
      });
      setStatus(removed ? `Removed ${removed.file.name}.` : "Clip removed.");
      return next;
    });
  };

  const onDragStart = (event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setClips((prev) => {
      const from = prev.findIndex((clip) => clip.id === active.id);
      const to = prev.findIndex((clip) => clip.id === over.id);
      if (from < 0 || to < 0) return prev;
      const next = arrayMove(prev, from, to);
      setStatus(
        `Sequence updated. Clip ${to + 1} is ${next[to]?.file.name ?? "moved"}.`,
      );
      return next;
    });
  };

  return {
    clips,
    activeId,
    setActiveId,
    draggingId,
    setDraggingId,
    draggingClip,
    status,
    setStatus,
    checking,
    dropzone,
    moveClip,
    removeClip,
    onDragStart,
    onDragEnd,
  };
}
