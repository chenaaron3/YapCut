/** Normalize client files before probe/upload (e.g. HEIC → JPEG). */

function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  return /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);
}

function jpegFileFromBlob(blob: Blob, sourceName: string, lastModified: number): File {
  const base = sourceName.replace(/\.(heic|heif)$/i, "");
  return new File([blob], `${base}.jpg`, {
    type: "image/jpeg",
    lastModified,
  });
}

/** Safari / macOS can often decode HEIC natively — skip WASM when possible. */
async function tryNativeHeicToJpeg(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx || bitmap.width <= 0 || bitmap.height <= 0) return null;
      ctx.drawImage(bitmap, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) return null;
      return jpegFileFromBlob(blob, file.name, file.lastModified);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

/**
 * Convert HEIC/HEIF to JPEG in the browser so Remotion + all browsers can display it.
 * Other files are returned unchanged.
 */
export async function prepareMediaFileForUpload(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  const native = await tryNativeHeicToJpeg(file);
  if (native) return native;

  try {
    const { heicTo } = await import("heic-to");
    const blob = await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.92,
    });
    return jpegFileFromBlob(blob, file.name, file.lastModified);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not convert ${file.name} from HEIC/HEIF. Try exporting as JPEG first. (${detail})`,
    );
  }
}
