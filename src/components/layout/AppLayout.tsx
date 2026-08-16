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
      <div className="ember-shell relative min-h-screen overflow-x-hidden selection:bg-[#FFA102] selection:text-[#450E16]">
        <div
          aria-hidden
          className="ember-grain pointer-events-none fixed inset-0 z-0 opacity-30"
        />
        <Navbar />
        <main className="relative z-10 mx-auto max-w-[1280px] px-6 pb-16 sm:px-10 lg:px-14">
          {children}
        </main>
      </div>
    </>
  );
}
