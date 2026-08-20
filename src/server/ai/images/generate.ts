import { fal } from "@fal-ai/client";

import { env } from "~/env";
import {
  BROLL_VARIANT_COUNT,
  IMAGE_MODELS,
  IMAGE_RESOLUTION,
} from "~/server/ai/images/types";
import type { ImageSize, RemoteStill, SourceImage } from "~/server/ai/images/types";

const IMAGE_PRESET: Record<
  ImageSize,
  {
    width: number;
    height: number;
    aspect: "1:1" | "9:16" | "16:9";
  }
> = {
  square: { width: 1024, height: 1024, aspect: "1:1" },
  portrait: { width: 768, height: 1344, aspect: "9:16" },
  landscape: { width: 1344, height: 768, aspect: "16:9" },
};

type FluxResult = {
  images?: { url: string; width?: number; height?: number }[];
};

function configureFal(): void {
  fal.config({ credentials: env.FAL_KEY });
}

function stillsFromResult(
  data: FluxResult,
  fallback: { width: number; height: number },
): RemoteStill[] {
  const stills: RemoteStill[] = [];
  for (const image of data.images ?? []) {
    if (!image?.url) continue;
    stills.push({
      url: image.url,
      width: image.width && image.width > 0 ? image.width : fallback.width,
      height: image.height && image.height > 0 ? image.height : fallback.height,
    });
  }
  if (stills.length === 0) {
    throw new Error("Image generation returned no URL");
  }
  return stills;
}

async function generateTextToImage(options: {
  model: string;
  prompt: string;
  preset: { width: number; height: number };
  numImages: number;
}): Promise<RemoteStill[]> {
  const result = await fal.subscribe(options.model, {
    input: {
      prompt: options.prompt,
      image_size: {
        width: options.preset.width,
        height: options.preset.height,
      },
      num_images: options.numImages,
    },
  });
  return stillsFromResult(result.data as FluxResult, options.preset);
}

/** Still from the low/high model map. `imageSize` maps onto square / 9:16 / 16:9 pixels. */
export const generateImage: SourceImage = async ({ prompt, imageSize }) => {
  configureFal();
  const stills = await generateTextToImage({
    model: IMAGE_MODELS[IMAGE_RESOLUTION].generate,
    prompt,
    preset: IMAGE_PRESET[imageSize],
    numImages: 1,
  });
  return stills[0]!;
};

/** Two variants. No ref → generate model; one ref URL → edit model. */
export async function generateBrollStills(options: {
  prompt: string;
  imageSize: ImageSize;
  referenceUrl?: string | null;
}): Promise<RemoteStill[]> {
  configureFal();
  const models = IMAGE_MODELS[IMAGE_RESOLUTION];
  const preset = IMAGE_PRESET[options.imageSize];
  const prompt = options.prompt.trim();
  const referenceUrl = options.referenceUrl?.trim() || null;
  console.log(
    `[broll] fal ${referenceUrl ? models.edit : models.generate} ${preset.width}x${preset.height}`,
  );

  if (referenceUrl) {
    const result =
      IMAGE_RESOLUTION === "high"
        ? await fal.subscribe(models.edit, {
            input: {
              prompt,
              image_url: referenceUrl,
              num_images: BROLL_VARIANT_COUNT,
              resolution_mode: preset.aspect,
            },
          })
        : await fal.subscribe(models.edit, {
            input: {
              prompt,
              image_urls: [referenceUrl],
              num_images: BROLL_VARIANT_COUNT,
              image_size: { width: preset.width, height: preset.height },
            },
          });
    return stillsFromResult(result.data as FluxResult, preset);
  }

  return generateTextToImage({
    model: models.generate,
    prompt,
    preset,
    numImages: BROLL_VARIANT_COUNT,
  });
}
