import { generateImage } from "~/server/ai/images/generate";
import { persistImage } from "~/server/ai/images/persist";
import { searchImage } from "~/server/ai/images/search";

import type { db } from "~/server/db";
import type { GeneratedAsset } from "~/server/ai/images/persist";
import type { ImageSize } from "~/server/ai/images/types";

type Database = typeof db;

export type AssetNeed = {
  query?: string | null;
  method: "search" | "generate";
  imageSize?: ImageSize | null;
};

export type { GeneratedAsset };

export async function sourceMotionAssets(options: {
  db: Database;
  projectId: string;
  needs: readonly AssetNeed[];
}): Promise<GeneratedAsset[]> {
  const out: GeneratedAsset[] = [];
  for (const need of options.needs) {
    const prompt = need.query?.trim() || "still";
    const imageSize = need.imageSize ?? "portrait";
    console.log(
      `[motion] ${need.method} size=${imageSize} query=${JSON.stringify(prompt)}`,
    );
    const still =
      need.method === "search"
        ? await searchImage({ prompt, imageSize })
        : await generateImage({ prompt, imageSize });
    out.push(
      await persistImage({
        db: options.db,
        projectId: options.projectId,
        still,
      }),
    );
  }
  return out;
}
