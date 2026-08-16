import { Plus } from "lucide-react";
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
  const projectsQuery = api.project.list.useQuery();
  const count = projectsQuery.data?.length ?? 0;

  return (
    <AppLayout
      title="Projects · YapCut"
      description="Your YapCut projects."
    >
      <div className="flex flex-col gap-6 pt-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="ember-mono text-[10px] font-semibold tracking-[.2em] text-[#DD5533] uppercase">
                Library
              </p>
              <h1 className="ember-display animate-rise mt-2 text-5xl leading-[.82] sm:text-7xl">
                Projects
              </h1>
              <p className="animate-rise-delay mt-2 text-sm text-[#432E6F]">
                {projectsQuery.isLoading
                  ? "Loading…"
                  : count === 0
                    ? "No edits yet"
                    : `${count} project${count === 1 ? "" : "s"}`}
              </p>
            </div>
            <Button
              size="lg"
              className="animate-rise-delay-2 h-auto rounded-[16px] border-2 border-[#450E16] bg-[#FFA102] px-4 py-2.5 text-[#450E16] shadow-[4px_4px_0_#450E16] hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-[#FFA102] hover:shadow-none"
              onClick={() => setCreateOpen(true)}
            >
              <Plus data-icon="inline-start" />
              New project
            </Button>
          </div>

          {projectsQuery.isLoading ? (
            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <li
                  key={i}
                  className="h-52 animate-pulse rounded-[24px] border-2 border-[#450E16]/20 bg-[#F5F9CE]"
                />
              ))}
            </ul>
          ) : null}

          {projectsQuery.isError ? (
            <p className="text-destructive mt-10 text-sm">
              Couldn’t load projects. Refresh and try again.
            </p>
          ) : null}

          {projectsQuery.data?.length === 0 ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="animate-rise-delay-2 mt-12 flex w-full max-w-lg flex-col items-start rounded-[24px] border-2 border-dashed border-[#450E16] bg-[#F5F9CE] px-8 py-12 text-left shadow-[6px_7px_0_#450E16] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[3px_3px_0_#450E16]"
            >
              <span className="flex size-10 items-center justify-center rounded-full border-2 border-[#450E16] bg-[#FFA102] text-[#450E16]">
                <Plus className="size-5" />
              </span>
              <span className="ember-display mt-5 text-2xl leading-none">
                Create your first edit
              </span>
              <span className="mt-2 max-w-sm text-sm leading-relaxed text-[#432E6F]">
                Drop in A-roll. We’ll transcribe, measure, and seed AI so you
                can cut from the transcript.
              </span>
            </button>
          ) : null}

          {projectsQuery.data && projectsQuery.data.length > 0 ? (
            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {projectsQuery.data.map((project, index) => (
                <li key={project.id}>
                  <ProjectCard
                    id={project.id}
                    title={project.title}
                    badge={project.badge}
                    failureReason={project.failureReason}
                    createProgress={project.createProgress ?? null}
                    updatedAt={project.updatedAt}
                    scheduledAt={project.scheduledAt}
                    previewUrl={project.previewUrl}
                    previewKind={project.previewKind}
                    index={index}
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
