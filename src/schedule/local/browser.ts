import fs from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { PLAYWRIGHT_PROFILE_DIR } from "~/schedule/local/config";
import { TIMEOUTS } from "~/schedule/local/timeouts";

export async function launchPersistentContext(): Promise<BrowserContext> {
  fs.mkdirSync(PLAYWRIGHT_PROFILE_DIR, { recursive: true });
  // Use installed Google Chrome (not Playwright's Chromium-for-Testing).
  // TikTok/Meta often block the testing build as "insecure".
  return chromium.launchPersistentContext(PLAYWRIGHT_PROFILE_DIR, {
    channel: "chrome",
    headless: false,
    // Large viewport so schedule controls fit; no CSS/device zoom (those blank Meta).
    viewport: { width: 1600, height: 1200 },
    acceptDownloads: true,
    permissions: ["clipboard-read", "clipboard-write"],
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
    timeout: 30_000,
  });
}

let shared: { context: BrowserContext; refs: number } | null = null;
let lock: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prev = lock;
  lock = next;
  return prev.then(fn).finally(() => release());
}

/**
 * Shared persistent Chrome so Instagram + TikTok can run in parallel
 * (one profile directory cannot be opened twice).
 */
export async function withBrowser<T>(
  fn: (context: BrowserContext) => Promise<T>,
): Promise<T> {
  const context = await withLock(async () => {
    if (shared) {
      shared.refs += 1;
      return shared.context;
    }
    const launched = await launchPersistentContext();
    shared = { context: launched, refs: 1 };
    return launched;
  });
  try {
    return await fn(context);
  } finally {
    await withLock(async () => {
      if (!shared) return;
      shared.refs -= 1;
      if (shared.refs > 0) return;
      const ctx = shared.context;
      shared = null;
      await ctx.close();
    });
  }
}

export async function newPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUTS.pageDefault);
  page.setDefaultNavigationTimeout(TIMEOUTS.navigation);
  return page;
}

export async function settle(
  page: Page,
  ms: number = TIMEOUTS.settle,
): Promise<void> {
  await page.waitForTimeout(ms);
}

export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(async () => navigator.clipboard.readText());
}

export async function fillContentEditable(
  page: Page,
  locator: ReturnType<Page["locator"]>,
  text: string,
): Promise<void> {
  await locator.click({ timeout: TIMEOUTS.action });
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.type(text, { delay: 15 });
}
