import { useState } from "react";

import { AppLayout } from "~/components/layout/AppLayout";
import { CreateProjectModal } from "~/components/projects/CreateProjectModal";
import { ProjectCard } from "~/components/projects/ProjectCard";
import { Button } from "~/components/ui/button";
import { requireUser } from "~/server/auth/session";
import { api } from "~/utils/api";

import type { GetServerSideProps } from "next";
import type { Session } from "next-auth";

type Props = {
  session: Session | null;
};

export default function ProjectsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const projectsQuery = api.project.list.useQuery(undefined, {
    refetchInterval: (query) => {
      const list = query.state.data;
      if (!list) return false;
      return list.some((p) => p.status === "processing") ? 2000 : false;
    },
  });

  return (
    <AppLayout
      title="Projects · Talking Head"
      description="Your Talking Head projects."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Projects
        </h1>
        <Button size="lg" onClick={() => setCreateOpen(true)}>
          New project
        </Button>
      </div>

      {projectsQuery.isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading projects…</p>
      ) : null}

      {projectsQuery.isError ? (
        <p className="mt-10 text-sm text-destructive">
          Couldn’t load projects. Refresh and try again.
        </p>
      ) : null}

      {projectsQuery.data?.length === 0 ? (
        <div className="mt-14 max-w-md">
          <p className="text-muted-foreground">
            No projects yet. Create one to upload A-roll and start editing.
          </p>
        </div>
      ) : null}

      {projectsQuery.data && projectsQuery.data.length > 0 ? (
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {projectsQuery.data.map((project) => (
            <li key={project.id}>
              <ProjectCard
                id={project.id}
                title={project.title}
                status={project.status}
                failureReason={project.failureReason}
                updatedAt={project.updatedAt}
              />
            </li>
          ))}
        </ul>
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
