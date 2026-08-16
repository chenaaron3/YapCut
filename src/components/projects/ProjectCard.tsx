import { CircleAlert, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import {
  CREATE_STAGE_LABEL,
  overallCreateProgress,
} from "~/domain/create-progress";
import { PROJECT_LIST_BADGE_LABEL } from "~/domain/project-list-badge";
import { cn } from "~/lib/utils";

import type { CreateProgressEvent } from "~/domain/create-progress";
import type { ProjectListBadge } from "~/domain/project-list-badge";

type Props = {
  id: string;
  title: string | null;
  badge: ProjectListBadge;
  failureReason: string | null;
  createProgress: CreateProgressEvent | null;
  updatedAt: Date;
  scheduledAt: Date | null;
  previewUrl: string | null;
  previewKind: "image" | "video" | null;
  index?: number;
};

const POSTERS = [
  "from-[#BC2D29] via-[#450E16] to-[#432E6F]",
  "from-[#DD5533] via-[#BC2D29] to-[#450E16]",
  "from-[#432E6F] via-[#450E16] to-[#BC2D29]",
  "from-[#FFA102] via-[#DD5533] to-[#450E16]",
] as const;

function posterClass(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) {
    n = (n * 31 + id.charCodeAt(i)) >>> 0;
  }
  return POSTERS[n % POSTERS.length]!;
}

function formatUpdatedAt(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatScheduledAt(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function badgeClass(badge: ProjectListBadge): string {
  switch (badge) {
    case "failed":
      return "border-2 border-[#450E16] bg-[#BC2D29] text-[#F5F9CE]";
    case "creating":
      return "border-2 border-[#450E16] bg-[#FFA102] text-[#450E16]";
    case "exporting":
      return "border-2 border-[#450E16] bg-[#3B82F6] text-[#450E16]";
    case "scheduled":
      return "border-2 border-[#450E16] bg-[#A78BFA] text-[#450E16]";
    default:
      return "border-2 border-[#450E16] bg-[#F5F9CE] text-[#450E16]";
  }
}

function FirstFrameVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="metadata"
      className="absolute inset-0 h-full w-full object-cover"
      onLoadedMetadata={() => {
        const el = ref.current;
        if (el && el.currentTime < 0.05) el.currentTime = 0.05;
      }}
    />
  );
}

export function ProjectCard({
  id,
  title,
  badge,
  failureReason,
  createProgress,
  updatedAt,
  scheduledAt,
  previewUrl,
  previewKind,
  index = 0,
}: Props) {
  const trimmed = title?.trim() ?? "";
  const displayTitle = trimmed.length > 0 ? trimmed : "Untitled";
  const overall = createProgress ? overallCreateProgress(createProgress) : 0;
  const pct = Math.round(overall * 100);

  return (
    <Link
      href={`/projects/${id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="animate-rise group block rounded-[24px] outline-none focus-visible:ring-3 focus-visible:ring-[#FFA102]"
    >
      <article
        className={cn(
          "h-full overflow-hidden rounded-[24px] border-2 border-[#450E16] bg-[#F5F9CE]",
          "shadow-[6px_7px_0_#450E16] transition-[transform,box-shadow] duration-200 ease-out",
          "hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[3px_3px_0_#450E16]",
        )}
      >
        <div
          className={cn(
            "relative h-36 overflow-hidden bg-linear-to-br sm:h-40",
            posterClass(id),
          )}
        >
          {previewKind === "image" && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          {previewKind === "video" && previewUrl ? (
            <FirstFrameVideo src={previewUrl} />
          ) : null}
          {!previewUrl ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-12deg,transparent_0_18px,#ffffff08_18px_19px)]"
            />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-[#F5F9CE] to-transparent" />
          <span
            className={cn(
              "ember-mono absolute top-3 right-3 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
              badgeClass(badge),
            )}
          >
            {PROJECT_LIST_BADGE_LABEL[badge]}
          </span>
        </div>
        <div className="px-4 pt-1 pb-4">
          <h2 className="ember-display truncate text-xl tracking-tight">
            {displayTitle}
          </h2>
          <p className="ember-mono mt-1 text-[10px] tracking-[.12em] text-[#432E6F]/70 uppercase">
            {badge === "scheduled" && scheduledAt
              ? formatScheduledAt(scheduledAt)
              : formatUpdatedAt(updatedAt)}
          </p>
          {badge === "creating" ? (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <LoaderCircle className="size-3 animate-spin text-[#DD5533]" />
                <p className="text-muted-foreground truncate text-xs">
                  {createProgress?.label ?? CREATE_STAGE_LABEL.transcribe}
                </p>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[#450E16]/15">
                <div
                  className="h-full rounded-full bg-[#FFA102] transition-[width] duration-500"
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>
            </div>
          ) : null}
          {badge === "failed" && failureReason ? (
            <p className="text-destructive mt-3 flex items-start gap-1.5 text-xs leading-snug">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-clamp-2">{failureReason}</span>
            </p>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
