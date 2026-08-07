import Head from "next/head";
import type { ReactNode } from "react";

import { Navbar } from "~/components/layout/Navbar";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function AppLayout({ title, description, children }: Props) {
  return (
    <>
      <Head>
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="mx-auto max-w-5xl px-6 pb-16">{children}</main>
      </div>
    </>
  );
}
