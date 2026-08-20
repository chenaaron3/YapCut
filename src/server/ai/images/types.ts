export const IMAGE_SIZES = ["square", "portrait", "landscape"] as const;

export const IMAGE_RESOLUTIONS = ["low", "high"] as const;

export const BROLL_VARIANT_COUNT = 2;

export type ImageSize = (typeof IMAGE_SIZES)[number];

export type ImageResolution = (typeof IMAGE_RESOLUTIONS)[number];

/** Flip to `"high"` to use Flux / Kontext Dev. */
export const IMAGE_RESOLUTION: ImageResolution = "low";

/** Fal endpoints by quality tier. Low = Klein 9B; high = Flux / Kontext Dev. */
export const IMAGE_MODELS: Record<
  ImageResolution,
  { generate: string; edit: string }
> = {
  low: {
    generate: "fal-ai/flux-2/klein/9b",
    edit: "fal-ai/flux-2/klein/9b/edit",
  },
  high: {
    generate: "fal-ai/flux/dev",
    edit: "fal-ai/flux-kontext/dev",
  },
};

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
