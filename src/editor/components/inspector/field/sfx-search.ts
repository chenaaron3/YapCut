import { formatSfxLabel, sfxFolderOf } from "~/domain/edit/sfx";

export type SfxAssetOption = { id: string; originalFilename: string | null };

export function matchesSfxQuery(asset: SfxAssetOption, query: string): boolean {
  const path = asset.originalFilename;
  if (!path) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const label = formatSfxLabel(path, asset.id).toLowerCase();
  const folder = (sfxFolderOf(path) ?? "").toLowerCase();
  return (
    label.includes(q) || path.toLowerCase().includes(q) || folder.includes(q)
  );
}
