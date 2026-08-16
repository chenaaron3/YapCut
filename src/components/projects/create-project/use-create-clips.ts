import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

import {
  fileKey,
  formatFromName,
} from "~/components/projects/create-project/format";
import {
  createFileLimit,
  summarizeCreateRejections,
  usedFromCreateFiles,
} from "~/domain/create-limits";
import { probeVideoFile } from "~/editor/lib/probe-media";

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { ClipItem } from "~/components/projects/create-project/types";
import type { CreateLimitCode, CreateMediaInput } from "~/domain/create-limits";

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

export function useCreateClips(open: boolean, busy = false) {
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [status, setStatus] = useState("Drop videos to start a sequence.");
  const [limitError, setLimitError] = useState<string | null>(null);
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
    setLimitError(null);
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
        setLimitError(null);
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
          let unreadable = 0;

          for (const file of incoming) {
            const key = fileKey(file);
            if (seen.has(key)) continue;
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
          }

          const parts: string[] = [];
          if (rejected.length > 0) {
            parts.push(summarizeCreateRejections(rejected));
          }
          if (unreadable > 0) {
            parts.push(
              unreadable === 1
                ? "Couldn’t read one video."
                : `Couldn’t read ${unreadable} videos.`,
            );
          }
          setLimitError(parts.length > 0 ? parts.join(" ") : null);
        } finally {
          setChecking(false);
        }
      })();
    },
    [checking],
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
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      const next = prev.filter((clip) => clip.id !== id);
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
    limitError,
    checking,
    dropzone,
    moveClip,
    removeClip,
    onDragStart,
    onDragEnd,
  };
}
