/** Client-side natural size (+ duration for video) before b-roll upload. */

export type ProbedMedia = {
  width: number;
  height: number;
  durationSec?: number;
};

function revokeLater(url: string) {
  // Delay revoke so the element can finish loading metadata.
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

export function probeImageFile(file: File): Promise<ProbedMedia> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      revokeLater(url);
      if (width <= 0 || height <= 0) {
        reject(new Error(`Could not read dimensions for ${file.name}`));
        return;
      }
      resolve({ width, height });
    };
    img.onerror = () => {
      revokeLater(url);
      reject(new Error(`Failed to load image ${file.name}`));
    };
    img.src = url;
  });
}

export function probeVideoFile(file: File): Promise<ProbedMedia> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const durationSec = video.duration;
      revokeLater(url);
      if (width <= 0 || height <= 0 || !Number.isFinite(durationSec)) {
        reject(new Error(`Could not read metadata for ${file.name}`));
        return;
      }
      resolve({ width, height, durationSec });
    };
    video.onerror = () => {
      revokeLater(url);
      reject(new Error(`Failed to load video ${file.name}`));
    };
    video.src = url;
  });
}

export async function probeMediaFile(file: File): Promise<ProbedMedia> {
  if (file.type.startsWith("image/")) return probeImageFile(file);
  if (file.type.startsWith("video/")) return probeVideoFile(file);
  throw new Error(`Unsupported media type: ${file.type || file.name}`);
}
