export type ClipUploadStatus = "queued" | "uploading" | "done" | "error";

export type ClipItem = {
  id: string;
  file: File;
  previewUrl: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  format: string;
  assetId: string | null;
  uploadStatus: ClipUploadStatus;
  /** 0–1 while uploading. */
  uploadProgress: number;
  uploadError: string | null;
};

export type CreatePhase = "idle" | "finalizing";

export type ClipUploadPatch = Partial<
  Pick<ClipItem, "assetId" | "uploadStatus" | "uploadProgress" | "uploadError">
>;

export type CreateUploader = {
  uploadClips: (
    clips: ClipItem[],
    update: (id: string, patch: ClipUploadPatch) => void,
  ) => void;
  removeClipAsset: (clip: ClipItem) => void;
};
