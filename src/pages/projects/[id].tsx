import Link from "next/link";
import { useRouter } from "next/router";

import { AppLayout } from "~/components/layout/AppLayout";
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
  const projectQuery = api.project.byId.useQuery(
    { id },
    {
      enabled: id.length > 0,
      refetchInterval: (query) =>
        query.state.data?.status === "processing" ? 2000 : false,
    },
  );

  const trimmedTitle = projectQuery.data?.title?.trim() ?? "";
  const title = trimmedTitle.length > 0 ? trimmedTitle : "Untitled";
  const status = projectQuery.data?.status;

  if (status === "ready" || status === "exporting") {
    return <EditorShell projectId={id} />;
  }

  return (
    <AppLayout title={`${title} · Talking Head`}>
      {projectQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {projectQuery.data === null ? (
        <p className="text-sm text-muted-foreground">Project not found.</p>
      ) : null}
      {projectQuery.data ? (
        <>
          <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            {status === "processing"
              ? "Still creating — transcription and AI seeding are running. This page refreshes automatically."
              : status === "failed"
                ? "Create failed. Failure reason is shown below."
                : `This project is ${status}.`}
          </p>
          {status === "failed" && projectQuery.data.failureReason ? (
            <p className="mt-4 max-w-lg text-sm text-destructive">
              {projectQuery.data.failureReason}
            </p>
          ) : null}
          <Link
            href="/projects"
            className={cn(
              buttonVariants({ variant: "link" }),
              "mt-8 h-auto px-0",
            )}
          >
            ← Back to projects
          </Link>
        </>
      ) : null}
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = (ctx) =>
  requireUser(ctx);
