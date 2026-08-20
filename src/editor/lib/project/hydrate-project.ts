import type { EditorAsset } from "~/editor/store";
import type { RouterOutputs } from "~/utils/api";

type ProjectById = NonNullable<RouterOutputs["project"]["byId"]>;

/** Build a store hydrate payload. Extra assets (globals / current library) lose to the project snapshot on id clash. */
export function hydrateInputFromProject(
  data: ProjectById,
  extraAssets: EditorAsset[] = [],
) {
  const byId = new Map<string, EditorAsset>();
  for (const asset of extraAssets) byId.set(asset.id, asset);
  for (const asset of data.assets) byId.set(asset.id, asset);

  return {
    id: data.id,
    title: data.title,
    status: data.status,
    config: data.config,
    configUpdatedAt: data.configUpdatedAt?.toISOString() ?? null,
    assets: [...byId.values()],
    // Only assets that have a transcript row — b-roll/etc. must not be
    // hydrated as empty maps or autosave will 404 on updateTranscriptWords.
    transcripts: data.assets.flatMap((asset) =>
      asset.transcript
        ? [{ assetId: asset.id, words: asset.transcript.words ?? [] }]
        : [],
    ),
  };
}
