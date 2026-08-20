/** S3 key layout helpers. */

export function assetSourceKey(projectId: string, assetId: string): string {
  return `projects/${projectId}/assets/${assetId}/source`;
}

/** Hard-mask object nested under the source asset. */
export function assetMaskKey(projectId: string, assetId: string): string {
  return `projects/${projectId}/assets/${assetId}/mask`;
}

export const GLOBAL_SFX_PREFIX = "global/sfx/";
export const GLOBAL_MUSIC_PREFIX = "global/music/";

/** Global SFX library object key. `relativePath` e.g. `reveal/item.mp3`. */
export function globalSfxKey(relativePath: string): string {
  const cleaned = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  return `${GLOBAL_SFX_PREFIX}${cleaned}`;
}

export function globalMusicKey(relativePath: string): string {
  const cleaned = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  return `${GLOBAL_MUSIC_PREFIX}${cleaned}`;
}

export function isGlobalSfxKey(s3Key: string): boolean {
  return s3Key.startsWith(GLOBAL_SFX_PREFIX);
}

export function isGlobalMusicKey(s3Key: string): boolean {
  return s3Key.startsWith(GLOBAL_MUSIC_PREFIX);
}

export function exportKey(projectId: string, timestamp: string): string {
  return `exports/${projectId}/${timestamp}.mp4`;
}
