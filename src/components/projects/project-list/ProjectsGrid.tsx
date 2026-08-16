import { ProjectCard } from "~/components/projects/ProjectCard";

import type { ProjectListItem } from "./types";

type Props = {
  projects: readonly ProjectListItem[];
};

export function ProjectsGrid({ projects }: Props) {
  return (
    <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {projects.map((project, index) => (
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
  );
}
