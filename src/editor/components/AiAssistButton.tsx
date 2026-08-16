import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  isEditorProjectStatus,
  isProjectStatus,
} from "~/domain/project-status";
import { hydrateInputFromProject } from "~/editor/lib/hydrate-project";
import { useEditor } from "~/editor/store";
import { api } from "~/utils/api";

export function AiAssistButton() {
  const projectId = useEditor((s) => s.projectId);
  const status = useEditor((s) => s.status);
  const dirty = useEditor((s) => s.configDirty || s.transcriptsDirty);
  const save = useEditor((s) => s.save);
  const hydrateFromServer = useEditor((s) => s.hydrateFromServer);
  const clearForAiAssist = useEditor((s) => s.clearForAiAssist);

  const utils = api.useUtils();

  const mutation = api.project.runAiAssist.useMutation({
    onSuccess: async () => {
      if (!projectId) return;
      const data = await utils.project.byId.fetch({ id: projectId });
      if (!data) return;
      if (
        !isProjectStatus(data.status) ||
        !isEditorProjectStatus(data.status)
      ) {
        return;
      }
      hydrateFromServer(
        hydrateInputFromProject(data, useEditor.getState().assets),
      );
    },
  });

  if (!projectId) return null;

  const busy = mutation.isPending;
  const disabled = busy || status === "exporting";

  const onClick = async () => {
    try {
      if (dirty) await save();
      clearForAiAssist();
      await mutation.mutateAsync({ id: projectId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ember-ghost"
        size="sm"
        disabled={disabled}
        onClick={() => void onClick()}
        title="Generate a new set of edits with AI"
        className="h-7 rounded-[10px] px-2.5 text-xs"
      >
        <Sparkles className="size-3.5" />
        {busy ? "Generating…" : "Generate edits"}
      </Button>
    </div>
  );
}
