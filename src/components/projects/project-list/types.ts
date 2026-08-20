import type { ProjectListBadge } from "~/domain/project/project-list-badge";
import type { RouterOutputs } from "~/utils/api";

export type ProjectListItem = RouterOutputs["project"]["list"]["items"][number];

export type ProjectStatusFilter = ProjectListBadge | "all";
