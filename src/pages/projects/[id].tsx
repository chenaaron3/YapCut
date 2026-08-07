import Link from "next/link";
import { useRouter } from "next/router";

import { AppLayout } from "~/components/layout/AppLayout";
import { buttonVariants } from "~/components/ui/button";
import { requireUser } from "~/server/auth/session";
import { api } from "~/utils/api";
import { cn } from "~/lib/utils";

import type { GetServerSideProps } from "next";
import type { Session } from "next-auth";

type Props = {
  session: Session | null;
};

export default function ProjectStubPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const projectQuery = api.project.byId.useQuery(
    { id },
    { enabled: id.length > 0 },
  );

  const trimmedTitle = projectQuery.data?.title?.trim() ?? "";
  const title = trimmedTitle.length > 0 ? trimmedTitle : "Untitled";

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
            Editor shell arrives in Milestone 4. This project is{" "}
            <span className="text-foreground">{projectQuery.data.status}</span>.
          </p>
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
