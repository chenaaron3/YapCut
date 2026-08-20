import type { PlatformId } from "~/domain/schedule/schedule";
import type { Publisher } from "~/schedule/publisher";
import { createInstagramPublisher } from "~/schedule/local/platforms/instagram";
import { createTikTokPublisher } from "~/schedule/local/platforms/tiktok";
import { youtubePublisher } from "~/schedule/local/platforms/youtube";

/** Local Playwright/API Publisher implementations (hot-swappable via Publisher port). */
export function createLocalPublishers(
  platforms: PlatformId[],
  timeZone: string,
): Publisher[] {
  const all: Record<PlatformId, Publisher> = {
    youtube: youtubePublisher,
    instagram: createInstagramPublisher(timeZone),
    tiktok: createTikTokPublisher(timeZone),
  };
  return platforms.map((id) => all[id]);
}
