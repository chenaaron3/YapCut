import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect } from "react";

import {
  clearUnclaimedProjectId,
  readUnclaimedProjectId,
} from "~/components/landing/unclaimed-project";
import { AppLayout } from "~/components/layout/AppLayout";
import { EmberLoading } from "~/components/layout/EmberLoading";
import { RequireUser } from "~/components/layout/RequireUser";
import { CreateProgressBar } from "~/components/projects/CreateProgressBar";
import { useCreateProgressStream } from "~/components/projects/use-create-progress-stream";
import { isEditorProjectStatus, isProjectStatus } from "~/domain/project-status";
import { EditorShell } from "~/editor/components/EditorShell";
import { api } from "~/utils/api";

import type { RouterOutputs } from "~/utils/api";

type ListResult = RouterOutputs["project"]["list"];

function useListedProject(id: string) {
  const queryClient = useQueryClient();
  if (id.length === 0) return undefined;
  const matches = queryClient.getQueriesData<ListResult>({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (key === "project.list") return true;
      return (
        Array.isArray(key) && key[0] === "project" && key[1] === "list"
      );
    },
  });
  for (const [, data] of matches) {
    const item = data?.items.find((row) => row.id === id);
    if (item) return item;
  }
  return undefined;
}

export default function ProjectPage() {
  return (
    <RequireUser>
      <ProjectPageInner />
    </RequireUser>
  );
}

function ProjectPageInner() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const utils = api.useUtils();
  const listed = useListedProject(id);
  const projectQuery = api.project.byId.useQuery(
    { id },
    { enabled: id.length > 0 },
  );

  useEffect(() => {
    if (id && readUnclaimedProjectId() === id) clearUnclaimedProjectId();
  }, [id]);

  const project = projectQuery.data;
  const status = project?.status ?? listed?.status;
  const progress = useCreateProgressStream({
    projectId: id,
    enabled: status === "processing",
    fallback: project?.createProgress ?? listed?.createProgress ?? null,
    onTerminal: () => {
      void utils.project.byId.invalidate({ id });
      void utils.project.list.invalidate();
    },
  });

  const trimmedTitle =
    project?.title?.trim() ?? listed?.title?.trim() ?? "";
  const title = trimmedTitle.length > 0 ? trimmedTitle : "Untitled";

  if (
    id.length === 0 ||
    (projectQuery.isLoading && project == null && listed == null)
  ) {
    return (
      <AppLayout title="YapCut">
        <EmberLoading />
      </AppLayout>
    );
  }

  if (status && isProjectStatus(status) && isEditorProjectStatus(status)) {
    return <EditorShell projectId={id} />;
  }

  return (
    <AppLayout title={`${title} · YapCut`}>
      <div className="relative">
        <div className="relative">
          {project === null && listed == null ? (
            <p className="text-sm text-[#432E6F]">Project not found.</p>
          ) : null}
          {project ?? listed ? (
            <div className="mx-auto max-w-lg pt-10">
              {status === "processing" || status === "failed" ? (
                <div className="animate-rise-delay-2 mt-10">
                  <CreateProgressBar
                    event={
                      status === "failed"
                        ? (project?.createProgress ??
                          listed?.createProgress ??
                          progress)
                        : progress
                    }
                    failed={status === "failed"}
                    failureReason={
                      project?.failureReason ?? listed?.failureReason ?? null
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
