import Link from "next/link";
import { useRouter } from "next/router";

import { AppLayout } from "~/components/layout/AppLayout";
import { CreateProgressBar } from "~/components/projects/CreateProgressBar";
import { useCreateProgressStream } from "~/components/projects/use-create-progress-stream";
import { buttonVariants } from "~/components/ui/button";
import { EditorShell } from "~/editor/components/EditorShell";
import { cn } from "~/lib/utils";
import { requireUser } from "~/server/auth/session";
import { api } from "~/utils/api";

import type { GetServerSideProps } from "next";
import type { Session } from "next-auth";

type Props = {
  session: Session | null;
};

export default function ProjectPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const utils = api.useUtils();
  const projectQuery = api.project.byId.useQuery(
    { id },
    { enabled: id.length > 0 },
  );

  const status = projectQuery.data?.status;
  const progress = useCreateProgressStream({
    projectId: id,
    enabled: status === "processing",
    fallback: projectQuery.data?.createProgress ?? null,
    onTerminal: () => {
      void utils.project.byId.invalidate({ id });
      void utils.project.list.invalidate();
    },
  });

  const trimmedTitle = projectQuery.data?.title?.trim() ?? "";
  const title = trimmedTitle.length > 0 ? trimmedTitle : "Untitled";

  if (status === "ready" || status === "exporting") {
    return <EditorShell projectId={id} />;
  }

  return (
    <AppLayout title={`${title} · Talking Head`}>
      <div className="relative">
        <div className="relative">
          {projectQuery.isLoading ? (
            <p className="text-sm text-[#432E6F]">Loading…</p>
          ) : null}
          {projectQuery.data === null ? (
            <p className="text-sm text-[#432E6F]">Project not found.</p>
          ) : null}
          {projectQuery.data ? (
            <div className="mx-auto max-w-lg pt-10">
              <Link
                href="/projects"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "mb-8 -ml-2 text-[#432E6F]",
                )}
              >
                ← Projects
              </Link>
              <p className="ember-display animate-rise text-5xl leading-[.82] sm:text-6xl">
                {title}
              </p>
              <p className="animate-rise-delay mt-3 text-base text-[#432E6F]">
                {status === "processing"
                  ? "We’ll open the editor when this finishes."
                  : status === "failed"
                    ? "Something went wrong while creating this project."
                    : `This project is ${status}.`}
              </p>
              {status === "processing" || status === "failed" ? (
                <div className="animate-rise-delay-2 mt-10">
                  <CreateProgressBar
                    event={
                      status === "failed"
                        ? (projectQuery.data.createProgress ?? progress)
                        : progress
                    }
                    failed={status === "failed"}
                    failureReason={projectQuery.data.failureReason}
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

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  requireUser(ctx);
