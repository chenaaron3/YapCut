import type { ProjectListBadge } from "~/domain/project-list-badge";
import type { RouterOutputs } from "~/utils/api";

export type ProjectListItem = RouterOutputs["project"]["list"][number];

export type ProjectStatusFilter = ProjectListBadge | "all";
