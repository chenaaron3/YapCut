export type ClipItem = {
  id: string;
  file: File;
  previewUrl: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  format: string;
};

export type CreatePhase = "idle" | "uploading" | "finalizing";
