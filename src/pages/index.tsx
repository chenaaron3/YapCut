import { signIn } from "next-auth/react";
import Head from "next/head";

import { Button } from "~/components/ui/button";
import { requireGuest } from "~/server/auth/session";

import type { GetServerSideProps } from "next";

export default function LandingPage() {
  return (
    <>
      <Head>
        <title>Talking Head</title>
        <meta
          name="description"
          content="Edit talking-head videos from the transcript."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div
          aria-hidden
          className="animate-drift pointer-events-none absolute inset-[-10%] bg-[radial-gradient(ellipse_at_15%_0%,#1e3a5f_0%,transparent_50%),radial-gradient(ellipse_at_90%_70%,#2a1f4a_0%,transparent_45%),linear-gradient(165deg,#12141a_0%,#161922_50%,#1a1d26_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-12deg,transparent_0_22px,#2e3444_22px_23px)] opacity-40"
        />
        <div
          aria-hidden
          className="animate-pulse-line pointer-events-none absolute top-[18%] right-0 left-0 h-px bg-linear-to-r from-transparent via-primary/60 to-transparent"
        />

        <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-end px-6 pt-24 pb-16 sm:justify-center sm:pt-16 sm:pb-24">
          <p className="animate-rise text-5xl font-semibold leading-[0.95] tracking-tight text-foreground sm:text-7xl md:text-8xl">
            Talking Head
          </p>
          <p className="animate-rise-delay mt-6 max-w-md text-lg text-muted-foreground sm:text-xl">
            Cut, caption, and stage talking-head videos from the transcript.
          </p>
          <div className="animate-rise-delay-2 mt-10">
            <Button
              size="lg"
              className="px-7 text-sm font-semibold tracking-wide"
              onClick={() =>
                void signIn("google", { callbackUrl: "/projects" })
              }
            >
              Log in with Google
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = (ctx) =>
  requireGuest(ctx);
