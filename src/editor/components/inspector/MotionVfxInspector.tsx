import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { DEFAULT_CAPTION_TEMPLATE_ID } from "~/domain/project/project-config";
import { TRANSFORM_DEFAULTS, transformOf } from "~/domain/edit/transform";
import {
  CaptionStyleFields,
  TextField,
  TransformFields,
} from "~/editor/components/inspector/field";
import { StyleTemplatePicker } from "~/editor/components/inspector/StyleTemplatePicker";
import { useEditor } from "~/editor/store";
import { normalizeCaptionOverrides } from "~/remotion/captions/parse-style";
import {
  CAPTION_TEMPLATE_LIST,
  isCaptionTemplateId,
  resolveCaptionTemplateStyle,
} from "~/remotion/templates/caption";
import {
  mergeTemplateStyleOverrides,
  resolveTemplateId,
  resolveTemplateStyle,
} from "~/remotion/templates/style";
import { api } from "~/utils/api";

import type { VfxMotionEdit } from "~/domain/project/project-config";

export function MotionVfxInspector({ edit }: { edit: VfxMotionEdit }) {
  const projectId = useEditor((s) => s.projectId);
  const patchEdit = useEditor((s) => s.patchEdit);
  const addAssets = useEditor((s) => s.addAssets);
  const revising = edit.plan != null;
  const [prompt, setPrompt] = useState("");
  useEffect(() => {
    setPrompt("");
  }, [edit.id]);
  const templateId = resolveTemplateId(
    edit.style,
    isCaptionTemplateId,
    DEFAULT_CAPTION_TEMPLATE_ID,
  );
  const style = resolveTemplateStyle(
    edit.style,
    isCaptionTemplateId,
    DEFAULT_CAPTION_TEMPLATE_ID,
    resolveCaptionTemplateStyle,
  );
  const overrides = normalizeCaptionOverrides(edit.style?.overrides);

  const generate = api.project.generateMotion.useMutation({
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const onGenerate = () => {
    if (!projectId) return;
    const instruction = prompt.trim();
    if (!instruction) {
      toast.error(
        revising ? "Describe the change first." : "Describe the overlay first.",
      );
      return;
    }
    generate.mutate(
      {
        id: projectId,
        start: edit.start,
        end: edit.end,
        prompt: instruction,
        plan: revising ? edit.plan : null,
      },
      {
        onSuccess: (data) => {
          if (data.assets.length > 0) addAssets(data.assets);
          patchEdit(edit.id, { plan: data.plan });
          setPrompt("");
        },
      },
    );
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <TextField
        label={revising ? "Change" : "Describe"}
        value={prompt}
        multiline
        onLiveChange={setPrompt}
      />
      <Button
        type="button"
        size="sm"
        disabled={generate.isPending || !prompt.trim()}
        onClick={onGenerate}
      >
        <Sparkles className="size-3.5" />
        {generate.isPending ? "Generating…" : revising ? "Update" : "Generate"}
      </Button>
      {revising ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            patchEdit(edit.id, { plan: null });
            setPrompt("");
          }}
        >
          Reset
        </Button>
      ) : null}
      {edit.plan ? (
        <p className="text-muted-foreground text-[11px] leading-snug">
          {edit.plan.category} — {edit.plan.brief}
        </p>
      ) : null}
      <StyleTemplatePicker
        templates={CAPTION_TEMPLATE_LIST}
        value={templateId}
        fallbackStyle={style}
        onChange={(id) => {
          const tid = isCaptionTemplateId(id) ? id : DEFAULT_CAPTION_TEMPLATE_ID;
          patchEdit(edit.id, {
            style: { templateId: tid, overrides: edit.style.overrides },
          });
        }}
      />
      <CaptionStyleFields
        overrides={overrides}
        resolvedFill={style.wordStyle.fill}
        resolvedY={style.y}
        resolvedFontSize={style.fontSize}
        resolvedFontFamily={style.fontFamily}
        onPatch={(partial, live) =>
          patchEdit(
            edit.id,
            {
              style: mergeTemplateStyleOverrides(
                edit.style,
                partial,
                isCaptionTemplateId,
                DEFAULT_CAPTION_TEMPLATE_ID,
              ),
            },
            live,
          )
        }
        showCaptionsAtATime={false}
        showY={false}
        showArc={false}
      />
      <TransformFields
        transform={transformOf(edit)}
        defaults={TRANSFORM_DEFAULTS}
        onPatch={(partial, live) => patchEdit(edit.id, partial, live)}
      />
    </div>
  );
}
