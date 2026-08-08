/** S3 key layout helpers. */

export function assetSourceKey(projectId: string, assetId: string): string {
  return `projects/${projectId}/assets/${assetId}/source`;
}

export function exportKey(projectId: string, timestamp: string): string {
  return `exports/${projectId}/${timestamp}.mp4`;
}
