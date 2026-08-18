import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { readUnclaimedProjectId } from "~/components/landing/unclaimed-project";
import { AppLayout } from "~/components/layout/AppLayout";
import { EmberLoading } from "~/components/layout/EmberLoading";
import { CreateProjectModal } from "~/components/projects/CreateProjectModal";
import { ProjectsEmptyLibrary } from "~/components/projects/project-list/ProjectsEmptyLibrary";
import { ProjectsGrid } from "~/components/projects/project-list/ProjectsGrid";
import { ProjectsHeader } from "~/components/projects/project-list/ProjectsHeader";
import { ProjectsLoadingGrid } from "~/components/projects/project-list/ProjectsLoadingGrid";
import { ProjectsNoMatches } from "~/components/projects/project-list/ProjectsNoMatches";
import { ProjectsPagination } from "~/components/projects/project-list/ProjectsPagination";
import { useProjectList } from "~/components/projects/project-list/use-project-list";
import { requireUser } from "~/server/auth/session";

import type { GetServerSideProps } from "next";
import type { Session } from "next-auth";

type Props = {
  session: Session | null;
};

export default function ProjectsPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const list = useProjectList();

  useEffect(() => {
    const id = readUnclaimedProjectId();
    if (id) {
      void router.replace(`/projects/${id}`);
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <AppLayout title="Projects · YapCut" description="Your YapCut projects.">
        <EmberLoading />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Projects · YapCut" description="Your YapCut projects.">
      <ProjectsHeader
        loading={list.isLoading}
        count={list.count}
        filteredCount={list.filteredCount}
        filtering={list.filtering}
        query={list.query}
        onQueryChange={list.setQuery}
        status={list.status}
        onStatusChange={list.setStatus}
        onCreate={() => setCreateOpen(true)}
      />

      {list.isLoading ? <ProjectsLoadingGrid /> : null}

      {list.isError ? (
        <p className="text-destructive mt-10 text-sm">
          Couldn’t load projects. Refresh and try again.
        </p>
      ) : null}

      {list.isEmpty ? (
        <ProjectsEmptyLibrary onCreate={() => setCreateOpen(true)} />
      ) : null}

      {list.noMatches ? (
        <ProjectsNoMatches onClear={list.clearFilters} />
      ) : null}

      {list.pageItems.length > 0 ? (
        <>
          <ProjectsGrid projects={list.pageItems} />
          <ProjectsPagination
            page={list.page}
            pageCount={list.pageCount}
            onPageChange={list.setPage}
          />
        </>
      ) : null}

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(projectId) => {
          void router.push(`/projects/${projectId}`);
        }}
      />
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  requireUser(ctx);
