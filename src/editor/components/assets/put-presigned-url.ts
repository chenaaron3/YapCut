export async function putToPresignedUrl(
  file: File,
  uploadUrl: string,
  contentType: string,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!response.ok) {
    throw new Error(
      `Upload failed for ${file.name} (${response.status} ${response.statusText})`,
    );
  }
}
