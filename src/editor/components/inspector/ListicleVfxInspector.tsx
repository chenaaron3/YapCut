import { OverlayVfxFields } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";
import type { VfxListicleEdit } from "~/domain/project/project-config";
import { DEFAULT_LISTICLE_TEMPLATE_ID } from "~/remotion/templates/overlay";

export function ListicleVfxInspector({ edit }: { edit: VfxListicleEdit }) {
  const patchListicleStyle = useEditor((s) => s.patchListicleStyle);
  const listicleStyle = useEditor((s) => s.config?.listicleStyle);

  return (
    <OverlayVfxFields
      edit={edit}
      style={listicleStyle}
      defaultTemplateId={DEFAULT_LISTICLE_TEMPLATE_ID}
      headingLabel="Heading"
      subheadingLabel="Subheading"
      onStyleChange={(style, live) => patchListicleStyle(style, live)}
    />
  );
}
