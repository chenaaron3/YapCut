import { useState } from "react";

import { AppLayout } from "~/components/layout/AppLayout";
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
  const [createOpen, setCreateOpen] = useState(false);
  const list = useProjectList();

  return (
    <AppLayout
      title="Projects · YapCut"
      description="Your YapCut projects."
    >
      <ProjectsHeader
        loading={list.isLoading}
        count={list.count}
        filteredCount={list.filteredCount}
        filtering={list.filtering}
        query={list.query}
        onQueryChange={list.setQuery}
        status={list.status}
        onStatusChange={list.setStatus}
        availableStatuses={list.availableStatuses}
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
      />
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  requireUser(ctx);
