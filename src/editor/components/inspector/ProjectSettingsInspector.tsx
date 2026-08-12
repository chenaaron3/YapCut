import { formatSfxLabel } from "~/domain/sfx";
import { Label } from "~/components/ui/label";
import { useEditor } from "~/editor/store";

export function ProjectSettingsInspector() {
  const assets = useEditor((s) => s.assets);
  const config = useEditor((s) => s.config);
  const setDefaultBRollSfxAssetId = useEditor(
    (s) => s.setDefaultBRollSfxAssetId,
  );

  const sfxAssets = assets
    .filter((a) => a.audioLibrary === "sfx")
    .slice()
    .sort((a, b) =>
      formatSfxLabel(a.originalFilename, a.id).localeCompare(
        formatSfxLabel(b.originalFilename, b.id),
      ),
    );
  const defaultSfxId = config?.defaultBRollSfxAssetId ?? null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Default b-roll entrance SFX
        </Label>
        <select
          className="w-full rounded-md border border-border bg-panel-2 px-2 py-1.5 text-xs text-foreground"
          value={defaultSfxId ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            setDefaultBRollSfxAssetId(value.length > 0 ? value : null);
          }}
        >
          <option value="">None</option>
          {defaultSfxId && !sfxAssets.some((a) => a.id === defaultSfxId) ? (
            <option value={defaultSfxId}>{defaultSfxId.slice(0, 8)}…</option>
          ) : null}
          {sfxAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {formatSfxLabel(a.originalFilename, a.id)}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          When set, new b-roll drops also place a sibling SFX edit at the same
          start.
        </p>
      </div>
    </div>
  );
}
