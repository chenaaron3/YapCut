import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

export function SaveStatusBadge() {
  const dirty = useEditor((s) => s.configDirty || s.transcriptsDirty);
  const saving = useEditor((s) => s.saving);
  const label = saving ? "Saving…" : dirty ? "Unsaved" : "Saved";
  return (
    <span
      role="status"
      className="ember-mono inline-flex h-7 items-center gap-1.5 px-1 text-[10px] font-medium tracking-[.08em] text-[#F5F9CE]/55 uppercase"
      title={label}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          saving
            ? "bg-[#75677F]"
            : dirty
              ? "bg-[#FFA102] shadow-[0_0_0_3px_rgba(255,161,2,0.16)]"
              : "bg-sfx shadow-[0_0_0_3px_rgba(45,212,191,0.16)]",
        )}
      />
      {label}
    </span>
  );
}
