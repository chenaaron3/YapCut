import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "~/components/ui/button";
import { useEditor } from "~/editor/store";
import { api } from "~/utils/api";

export function AiAssistButton() {
  const projectId = useEditor((s) => s.projectId);
  const status = useEditor((s) => s.status);
  const dirty = useEditor((s) => s.configDirty || s.transcriptsDirty);
  const save = useEditor((s) => s.save);

  const [error, setError] = useState<string | null>(null);
  const utils = api.useUtils();

  const mutation = api.project.runAiAssist.useMutation({
    onSuccess: async () => {
      // Allow hydrateFromServer to accept the new snapshot.
      useEditor.setState({
        configDirty: false,
        transcriptsDirty: false,
        saving: false,
        error: null,
      });
      await utils.project.byId.invalidate({ id: projectId ?? "" });
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  if (!projectId) return null;

  const busy = mutation.isPending;
  const disabled = busy || status === "exporting";

  const onClick = async () => {
    const ok = window.confirm(
      "Re-run AI on this project?\n\nKeeps your cuts and b-roll. Replaces zooms, quotes, listicles, SFX, title card, and emphasis.",
    );
    if (!ok) return;

    setError(null);
    try {
      if (dirty) await save();
      await mutation.mutateAsync({ id: projectId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && !busy ? (
        <span
          className="max-w-50 truncate text-[11px] text-red-300"
          title={error}
        >
          {error}
        </span>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => void onClick()}
        title="Re-run create AI assist"
      >
        <Sparkles className="size-3.5" />
        {busy ? "AI…" : "AI"}
      </Button>
    </div>
  );
}
