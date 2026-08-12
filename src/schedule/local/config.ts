import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export const PLAYWRIGHT_PROFILE_DIR = path.join(
  ROOT,
  ".playwright",
  "profile",
);
export const YOUTUBE_CREDENTIALS_PATH = path.join(
  ROOT,
  "secrets",
  "youtube-credentials.json",
);
export const YOUTUBE_TOKEN_PATH = path.join(
  ROOT,
  "secrets",
  "youtube-token.json",
);
