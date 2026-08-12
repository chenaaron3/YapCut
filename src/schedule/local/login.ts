import { pathToFileURL } from "node:url";

import type { Page } from "playwright";

import { newPage, settle, withBrowser } from "~/schedule/local/browser";
import {
  authorizeYouTubeInteractive,
  isYouTubeAuthorized,
} from "~/schedule/local/platforms/youtube";

const META_HOME = "https://business.facebook.com/latest/home";
const TIKTOK_STUDIO = "https://www.tiktok.com/tiktokstudio";

/** Confirmed logged-in Business Suite surface (not login / OAuth). */
function isMetaSessionUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "business.facebook.com" &&
      u.pathname.startsWith("/latest/")
    );
  } catch {
    return false;
  }
}

/** Confirmed TikTok Studio surface (not /login). */
function isTikTokSessionUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname === "tiktok.com" ? "www.tiktok.com" : u.hostname;
    return host === "www.tiktok.com" && u.pathname.startsWith("/tiktokstudio");
  } catch {
    return false;
  }
}

async function hasMetaSession(page: Page): Promise<boolean> {
  await page.goto(META_HOME, { waitUntil: "domcontentloaded" });
  await settle(page, 2500);
  return isMetaSessionUrl(page.url());
}

async function hasTikTokSession(page: Page): Promise<boolean> {
  await page.goto(TIKTOK_STUDIO, { waitUntil: "domcontentloaded" });
  await settle(page, 2500);
  return isTikTokSessionUrl(page.url());
}

async function waitForEnter(message: string): Promise<void> {
  console.log(message);
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });
}

/**
 * Ensure YouTube / Instagram / TikTok credentials are present.
 * Skips platforms that already look authenticated.
 */
async function main() {
  console.log("[login] Checking platforms…");

  const youtubeOk = await isYouTubeAuthorized();
  if (youtubeOk) {
    console.log("[login] youtube: ok");
  } else {
    console.log("[login] youtube: needs auth");
    await authorizeYouTubeInteractive();
  }

  let metaOk = false;
  let tiktokOk = false;

  await withBrowser(async (context) => {
    const probeIg = await newPage(context);
    const probeTt = await newPage(context);
    try {
      [metaOk, tiktokOk] = await Promise.all([
        hasMetaSession(probeIg),
        hasTikTokSession(probeTt),
      ]);
    } finally {
      await probeIg.close();
      await probeTt.close();
    }

    console.log(`[login] instagram: ${metaOk ? "ok" : "needs login"}`);
    console.log(`[login] tiktok: ${tiktokOk ? "ok" : "needs login"}`);

    if (metaOk && tiktokOk) {
      return;
    }

    if (!metaOk) {
      const ig = await newPage(context);
      await ig.goto(META_HOME, { waitUntil: "domcontentloaded" });
    }
    if (!tiktokOk) {
      const tt = await newPage(context);
      await tt.goto("https://www.tiktok.com/login", {
        waitUntil: "domcontentloaded",
      });
    }

    await waitForEnter(
      "\n[login] Finish sign-in in the open window(s), then press Enter…\n",
    );
    console.log("[login] Browser session saved to .playwright/profile");
  });

  console.log("[login] done");
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
