import Head from "next/head";

import { LandingView } from "~/components/landing/LandingView";
import { requireGuest } from "~/server/auth/session";

import type { GetServerSideProps } from "next";

export default function LandingPage() {
  return (
    <>
      <Head>
        <title>YapCut</title>
        <meta
          name="description"
          content="Vertical talking-head edits, from words to ready-to-post."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <LandingView />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = (ctx) => requireGuest(ctx);
