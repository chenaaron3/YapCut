/** S3 key layout helpers. */

export function assetSourceKey(projectId: string, assetId: string): string {
  return `projects/${projectId}/assets/${assetId}/source`;
}

/**
 * Global SFX library object key.
 * `relativePath` is category/file under the pack, e.g. `beep-bop/ding_light.wav`.
 */
export function globalSfxKey(relativePath: string): string {
  const cleaned = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  return `global/sfx/${cleaned}`;
}

export function exportKey(projectId: string, timestamp: string): string {
  return `exports/${projectId}/${timestamp}.mp4`;
}
