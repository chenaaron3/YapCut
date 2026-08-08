import { useEffect, useState } from "react";

import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

/** Inline rename for Project.title (DB column — independent of text VFX). */
export function ProjectTitleField({
  className,
}: {
  className?: string;
}) {
  const projectId = useEditor((s) => s.projectId);
  const title = useEditor((s) => s.title);
  const setProjectTitle = useEditor((s) => s.setProjectTitle);
  const [draft, setDraft] = useState(title);
  const updateTitle = api.project.updateTitle.useMutation({
    onSuccess: (data) => {
      setProjectTitle(data.title ?? "Untitled");
    },
  });

  useEffect(() => {
    setDraft(title);
  }, [title]);

  const commit = () => {
    if (!projectId) return;
    const next = draft.trim();
    const current = title.trim();
    if (next === current || (next.length === 0 && current === "Untitled")) {
      setDraft(title);
      return;
    }
    setProjectTitle(next || "Untitled");
    updateTitle.mutate({ id: projectId, title: next });
  };

  return (
    <input
      type="text"
      value={draft}
      aria-label="Project title"
      className={cn(
        "min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1 text-sm font-semibold outline-none hover:border-border focus:border-ring focus:ring-1 focus:ring-ring/40",
        className,
      )}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(title);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
