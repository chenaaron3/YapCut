import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import type { Session } from "next-auth";

import { auth } from "~/server/auth";

export async function getServerSession(
  ctx: GetServerSidePropsContext,
): Promise<Session | null> {
  return auth(ctx);
}

/** Landing: send authenticated users to the app. */
export async function requireGuest(
  ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<{ session: Session | null }>> {
  const session = await getServerSession(ctx);
  if (session?.user) {
    return {
      redirect: { destination: "/projects", permanent: false },
    };
  }
  return { props: { session: null } };
}

/** App routes: require a session. */
export async function requireUser(
  ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<{ session: Session }>> {
  const session = await getServerSession(ctx);
  if (!session?.user) {
    return {
      redirect: { destination: "/", permanent: false },
    };
  }
  return { props: { session } };
}
