import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  clearUnclaimedProjectId,
  readUnclaimedProjectId,
  writeUnclaimedProjectId,
} from "~/components/landing/unclaimed-project";
import {
  isAbortError,
  putToPresignedUrl,
} from "~/components/projects/create-project/upload";
import { isDraftCreate } from "~/domain/project/create-draft";
import {
  CREATE_MAX_DURATION_SEC,
  LANDING_CREATE_MAX_BYTES,
} from "~/domain/project/create-limits";
import { probeVideoFile } from "~/editor/lib/player/probe-media";
import { api } from "~/utils/api";

export type LandingTrialPhase =
  "idle" | "restoring" | "uploading" | "processing" | "ready" | "failed";

function mutationMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const data = error as {
    data?: { message?: string };
    shape?: { message?: string };
  };
  return data.shape?.message ?? data.data?.message ?? error.message;
}

export function useLandingTrial() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<LandingTrialPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const busyRef = useRef(false);

  const utils = api.useUtils();
  const createStart = api.project.createStart.useMutation();
  const createFinalize = api.project.createFinalize.useMutation();
  const createDiscard = api.project.createDiscard.useMutation();
  const abandonUnclaimed = api.project.abandonUnclaimed.useMutation();
  const discardingDraftRef = useRef(false);

  const projectQuery = api.project.byId.useQuery(
    { id: projectId ?? "" },
    {
      enabled: Boolean(projectId) && hydrated,
      retry: false,
    },
  );

  useEffect(() => {
    const stored = readUnclaimedProjectId();
    setProjectId(stored);
    setHydrated(true);
    if (stored) setPhase("restoring");
  }, []);

  useEffect(() => {
    if (!hydrated || !projectId || projectQuery.isPending) return;

    if (projectQuery.data == null || projectQuery.isError) {
      clearUnclaimedProjectId();
      setProjectId(null);
      setPhase("idle");
      return;
    }

    const project = projectQuery.data;
    // In-flight landing upload is also a draft (no workflow yet). Only discard
    // leftovers from a refresh that lost the File.
    if (isDraftCreate(project)) {
      if (busyRef.current || phase === "uploading") return;
      if (discardingDraftRef.current) return;
      discardingDraftRef.current = true;
      void createDiscard
        .mutateAsync({ projectId: project.id })
        .catch(() => undefined)
        .finally(() => {
          discardingDraftRef.current = false;
          clearUnclaimedProjectId();
          setProjectId(null);
          setPhase("idle");
        });
      return;
    }

    if (project.status === "ready") {
      setPhase("ready");
      return;
    }
    if (project.status === "failed") {
      setPhase("failed");
      return;
    }
    if (project.status === "processing") {
      setPhase("processing");
    }
  }, [
    createDiscard,
    hydrated,
    projectId,
    projectQuery.data,
    projectQuery.isError,
    projectQuery.isPending,
    phase,
  ]);

  const locked =
    phase === "uploading" ||
    phase === "processing" ||
    phase === "ready" ||
    phase === "restoring";

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (busyRef.current || locked) return;
      const file = accepted[0];
      if (!file) return;

      if (file.size > LANDING_CREATE_MAX_BYTES) {
        toast.error(`Each video must be 250 MB or smaller (${file.name}).`);
        return;
      }

      busyRef.current = true;
      setPhase("uploading");
      setUploadProgress(0);

      const previousFailedId =
        phase === "failed" && projectId ? projectId : null;

      try {
        if (previousFailedId) {
          await abandonUnclaimed.mutateAsync({ projectId: previousFailedId });
          clearUnclaimedProjectId();
          setProjectId(null);
        }

        const probed = await probeVideoFile(file);
        const durationSec = probed.durationSec;
        if (durationSec == null || !Number.isFinite(durationSec)) {
          throw new Error(`Could not read duration for ${file.name}`);
        }
        if (durationSec > CREATE_MAX_DURATION_SEC) {
          throw new Error(
            `Video can be up to ${CREATE_MAX_DURATION_SEC / 60} minutes.`,
          );
        }

        const { projectId: id, uploads } = await createStart.mutateAsync({
          files: [
            {
              filename: file.name,
              contentType: file.type || "video/mp4",
              size: file.size,
              width: probed.width,
              height: probed.height,
              durationSec,
            },
          ],
        });
        const upload = uploads[0];
        if (!upload) throw new Error("Could not start upload");

        writeUnclaimedProjectId(id);
        setProjectId(id);

        await putToPresignedUrl(file, upload.uploadUrl, upload.contentType, {
          onProgress: setUploadProgress,
        });
        await createFinalize.mutateAsync({
          projectId: id,
          assetIds: [upload.assetId],
        });
        await utils.project.byId.invalidate({ id });
        setPhase("processing");
      } catch (error) {
        if (!isAbortError(error)) {
          toast.error(mutationMessage(error, "Could not start your video"));
        }
        const stuckId = readUnclaimedProjectId();
        if (stuckId) {
          await createDiscard
            .mutateAsync({ projectId: stuckId })
            .catch(() => undefined);
          clearUnclaimedProjectId();
        }
        setProjectId(null);
        setPhase("idle");
        setUploadProgress(0);
      } finally {
        busyRef.current = false;
      }
    },
    [
      abandonUnclaimed,
      createDiscard,
      createFinalize,
      createStart,
      locked,
      phase,
      projectId,
      utils.project.byId,
    ],
  );

  const onTerminal = useCallback(() => {
    if (!projectId) return;
    void utils.project.byId.invalidate({ id: projectId });
  }, [projectId, utils.project.byId]);

  return {
    projectId,
    phase,
    uploadProgress,
    acceptFiles: (files: File[]) => {
      void onDrop(files);
    },
    locked: locked || !hydrated,
    project: projectQuery.data ?? null,
    onTerminal,
  };
}
