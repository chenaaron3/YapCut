import type { SourceImage } from "~/server/ai/images/types";

const USER_AGENT = "talking-head-2-motion/1.0";

/** Wikimedia Commons search. `imageSize` is unused — Commons picks the pixels. */
export const searchImage: SourceImage = async ({ prompt }) => {
  const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("generator", "search");
  endpoint.searchParams.set("gsrsearch", prompt);
  endpoint.searchParams.set("gsrnamespace", "6");
  endpoint.searchParams.set("gsrlimit", "5");
  endpoint.searchParams.set("prop", "imageinfo");
  endpoint.searchParams.set("iiprop", "url|size");
  endpoint.searchParams.set("iiurlwidth", "1280");
  endpoint.searchParams.set("format", "json");
  const res = await fetch(endpoint, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Image search failed ${res.status}`);
  }
  const json = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          imageinfo?: {
            thumburl?: string;
            url?: string;
            thumbwidth?: number;
            thumbheight?: number;
            width?: number;
            height?: number;
          }[];
        }
      >;
    };
  };
  const pages = Object.values(json.query?.pages ?? {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const url = info?.thumburl ?? info?.url;
    if (!url) continue;
    const width = info?.thumburl ? info.thumbwidth : info?.width;
    const height = info?.thumburl ? info.thumbheight : info?.height;
    return {
      url,
      width: width && width > 0 ? width : null,
      height: height && height > 0 ? height : null,
    };
  }
  throw new Error(`Image search returned nothing for ${prompt}`);
};
