import { OverlayVfxFields } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";
import type { VfxTextEdit } from "~/domain/project-config";
import { DEFAULT_TEXT_TEMPLATE_ID } from "~/remotion/templates/overlay";

export function TextVfxInspector({ edit }: { edit: VfxTextEdit }) {
  const patchEdit = useEditor((s) => s.patchEdit);

  return (
    <OverlayVfxFields
      edit={edit}
      style={edit.style}
      defaultTemplateId={DEFAULT_TEXT_TEMPLATE_ID}
      headingLabel="Title"
      subheadingLabel="Subheading"
      onStyleChange={(style, live) => patchEdit(edit.id, { style }, live)}
    />
  );
}
