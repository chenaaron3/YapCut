import { fal } from "@fal-ai/client";

import { env } from "~/env";

import type { ImageSize, SourceImage } from "~/server/ai/images/types";

const PRESET: Record<
  ImageSize,
  {
    fal: "square_hd" | "portrait_16_9" | "landscape_16_9";
    width: number;
    height: number;
  }
> = {
  square: { fal: "square_hd", width: 1024, height: 1024 },
  portrait: { fal: "portrait_16_9", width: 576, height: 1024 },
  landscape: { fal: "landscape_16_9", width: 1024, height: 576 },
};

type FluxResult = {
  images?: { url: string; width?: number; height?: number }[];
};

function configureFal(): void {
  fal.config({ credentials: env.FAL_KEY });
}

/** Flux still. `imageSize` maps onto Fal HD presets. */
export const generateImage: SourceImage = async ({ prompt, imageSize }) => {
  configureFal();
  const preset = PRESET[imageSize];
  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt,
      image_size: preset.fal,
      num_images: 1,
    },
  });
  const data = result.data as FluxResult;
  const image = data.images?.[0];
  if (!image?.url) throw new Error("Image generation returned no URL");
  return {
    url: image.url,
    width: image.width && image.width > 0 ? image.width : preset.width,
    height: image.height && image.height > 0 ? image.height : preset.height,
  };
};
