import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, type ReactNode } from "react";

import { AppLayout } from "~/components/layout/AppLayout";
import { EmberLoading } from "~/components/layout/EmberLoading";

export function RequireUser({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      void router.replace("/");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <AppLayout title="YapCut">
        <EmberLoading />
      </AppLayout>
    );
  }

  return children;
}
