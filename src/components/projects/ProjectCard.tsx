import Link from "next/link";

import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";

import type { ProjectStatus } from "~/domain/project-status";

type Props = {
  id: string;
  title: string | null;
  status: ProjectStatus;
  failureReason: string | null;
  updatedAt: Date;
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  processing: "Processing",
  ready: "Ready",
  exporting: "Exporting",
  failed: "Failed",
};

function statusVariant(
  status: ProjectStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "failed":
      return "destructive";
    case "ready":
      return "secondary";
    case "processing":
    case "exporting":
      return "default";
    default:
      return "outline";
  }
}

function formatUpdatedAt(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function ProjectCard({
  id,
  title,
  status,
  failureReason,
  updatedAt,
}: Props) {
  const trimmed = title?.trim() ?? "";
  const displayTitle = trimmed.length > 0 ? trimmed : "Untitled";
  // M3: allow opening stub for processing/failed; editor unlocks at ready (M4).
  return (
    <Link
      href={`/projects/${id}`}
      className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card
        size="sm"
        className={cn("h-full transition-colors", "hover:ring-foreground/20")}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl leading-tight font-semibold tracking-tight">
              {displayTitle}
            </CardTitle>
            <Badge variant={statusVariant(status)} className="uppercase">
              {STATUS_LABEL[status]}
            </Badge>
          </div>
          <CardDescription>
            Updated {formatUpdatedAt(updatedAt)}
          </CardDescription>
          {status === "failed" && failureReason ? (
            <p className="line-clamp-2 text-xs text-destructive">
              {failureReason}
            </p>
          ) : null}
          {status === "processing" ? (
            <p className="text-xs text-muted-foreground">
              Creating project… editor unlocks when ready.
            </p>
          ) : null}
        </CardHeader>
      </Card>
    </Link>
  );
}
