import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { useEditor } from "~/editor/store";
import { api } from "~/utils/api";

export function AiAssistButton() {
  const projectId = useEditor((s) => s.projectId);
  const status = useEditor((s) => s.status);
  const dirty = useEditor((s) => s.configDirty || s.transcriptsDirty);
  const save = useEditor((s) => s.save);
  const clearForAiAssist = useEditor((s) => s.clearForAiAssist);

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
    setError(null);
    try {
      if (dirty) await save();
      clearForAiAssist();
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
        title="Generate a new set of edits with AI"
      >
        <Sparkles className="size-3.5" />
        {busy ? "Generating…" : "Generate edits"}
      </Button>
    </div>
  );
}
