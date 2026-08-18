import Head from "next/head";
import { useLayoutEffect } from "react";

import { EmberLoading } from "~/components/layout/EmberLoading";
import { ProjectsBackLink } from "~/components/layout/ProjectsBackLink";

export function useEditorLock(enabled = true) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add("editor-lock");
    return () => root.classList.remove("editor-lock");
  }, [enabled]);
}

export function EditorLoading() {
  return (
    <>
      <Head>
        <title>Editor · YapCut</title>
      </Head>
      <div className="fixed inset-0 overflow-hidden bg-[#12141A] text-[#F5F9CE]">
        <header className="relative z-30 flex h-11 items-center border-b border-[#450E16]/25 bg-[#BC2D29] px-3 text-[#F5F9CE]">
          <ProjectsBackLink />
        </header>
        <EmberLoading />
      </div>
    </>
  );
}
