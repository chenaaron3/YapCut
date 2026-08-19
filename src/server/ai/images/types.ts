export const IMAGE_SIZES = ["square", "portrait", "landscape"] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];

export type RemoteStill = {
  url: string;
  width: number | null;
  height: number | null;
};

/** Fetch or synthesize a still from a prompt and aspect. */
export type SourceImage = (input: {
  prompt: string;
  imageSize: ImageSize;
}) => Promise<RemoteStill>;
