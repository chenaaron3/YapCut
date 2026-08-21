/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/prefer-promise-reject-errors, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- OAuth callback server ported from prototype */
import fs from "node:fs";
import http from "node:http";
import { URL } from "node:url";
import { google } from "googleapis";
import {
  YOUTUBE_CREDENTIALS_PATH,
  YOUTUBE_TOKEN_PATH,
} from "~/schedule/local/config";
import { toRfc3339 } from "~/schedule/local/rfc3339";
import {
  disposeLocalMedia,
  materializePublishMedia,
} from "~/schedule/download-media";
import type { Publisher, PublishJob, PublishResult } from "~/schedule/publisher";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
];

type ClientSecrets = {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
};

function loadClientSecrets(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  if (!fs.existsSync(YOUTUBE_CREDENTIALS_PATH)) {
    throw new Error(
      `Missing ${YOUTUBE_CREDENTIALS_PATH}\n` +
        "Create an OAuth 2.0 Desktop client in Google Cloud Console,\n" +
        "enable YouTube Data API v3, and save the JSON as secrets/youtube-credentials.json",
    );
  }
  const raw = JSON.parse(
    fs.readFileSync(YOUTUBE_CREDENTIALS_PATH, "utf8"),
  ) as ClientSecrets;
  const cfg = raw.installed ?? raw.web;
  if (!cfg?.client_id || !cfg?.client_secret) {
    throw new Error(
      `Invalid OAuth client JSON at ${YOUTUBE_CREDENTIALS_PATH}`,
    );
  }
  return {
    clientId: cfg.client_id,
    clientSecret: cfg.client_secret,
    redirectUri: "http://127.0.0.1:0/oauth2callback",
  };
}

function createOAuthClient(port?: number): OAuth2Client {
  const secrets = loadClientSecrets();
  const redirectUri =
    port !== undefined
      ? `http://127.0.0.1:${port}/oauth2callback`
      : secrets.redirectUri;
  return new google.auth.OAuth2(
    secrets.clientId,
    secrets.clientSecret,
    redirectUri,
  );
}

export async function authorizeYouTubeInteractive(): Promise<void> {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Failed to bind OAuth callback server");
  }

  const oauth2 = createOAuthClient(addr.port);
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("[youtube-auth] Open this URL in your browser:\n");
  console.log(authUrl);
  console.log("\n[youtube-auth] Waiting for OAuth callback...");

  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("OAuth timed out after 5 minutes"));
    }, 5 * 60_000);

    server.on("request", async (req, res) => {
      try {
        if (!req.url) return;
        const url = new URL(req.url, `http://127.0.0.1:${addr.port}`);
        if (url.pathname !== "/oauth2callback") {
          res.writeHead(404);
          res.end();
          return;
        }
        const error = url.searchParams.get("error");
        if (error) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end(`Authorization failed: ${error}`);
          clearTimeout(timeout);
          reject(new Error(`OAuth error: ${error}`));
          return;
        }
        const authCode = url.searchParams.get("code");
        if (!authCode) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing code");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h2>YouTube auth complete.</h2><p>You can close this tab.</p></body></html>",
        );
        clearTimeout(timeout);
        resolve(authCode);
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  });

  server.close();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  fs.mkdirSync(YOUTUBE_TOKEN_PATH.replace(/[^/]+$/, ""), { recursive: true });
  fs.writeFileSync(YOUTUBE_TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf8");
  console.log(`[youtube-auth] Saved token → ${YOUTUBE_TOKEN_PATH}`);
}

async function getAuthenticatedYoutube() {
  if (!fs.existsSync(YOUTUBE_TOKEN_PATH)) {
    throw new Error(
      `Missing ${YOUTUBE_TOKEN_PATH}. Run: npm run schedule:login`,
    );
  }
  const oauth2 = createOAuthClient();
  const tokens = JSON.parse(fs.readFileSync(YOUTUBE_TOKEN_PATH, "utf8"));
  oauth2.setCredentials(tokens);
  oauth2.on("tokens", (fresh) => {
    const merged = { ...tokens, ...fresh };
    fs.writeFileSync(YOUTUBE_TOKEN_PATH, JSON.stringify(merged, null, 2), "utf8");
  });
  return google.youtube({ version: "v3", auth: oauth2 });
}

/** True when credentials + token exist and the API accepts them. */
export async function isYouTubeAuthorized(): Promise<boolean> {
  if (
    !fs.existsSync(YOUTUBE_CREDENTIALS_PATH) ||
    !fs.existsSync(YOUTUBE_TOKEN_PATH)
  ) {
    return false;
  }
  try {
    const youtube = await getAuthenticatedYoutube();
    await youtube.channels.list({ part: ["id"], mine: true });
    return true;
  } catch {
    return false;
  }
}

async function uploadThumbnail(
  youtube: ReturnType<typeof google.youtube>,
  videoId: string,
  coverPath: string,
): Promise<void> {
  try {
    await youtube.thumbnails.set({
      videoId,
      media: {
        mimeType: "image/jpeg",
        body: fs.createReadStream(coverPath),
      },
    });
    console.log(`[youtube] thumbnail set for ${videoId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[youtube] thumbnail upload failed (channel may need verification): ${message}`,
    );
  }
}

export const youtubePublisher: Publisher = {
  id: "youtube",

  async publish(job: PublishJob): Promise<PublishResult> {
    const local = await materializePublishMedia({
      video: job.video,
      cover: job.cover,
    });
    try {
      const youtube = await getAuthenticatedYoutube();
      const title = job.title.slice(0, 100);

      console.log(`[youtube] uploading ${local.videoPath}`);

      const status = job.immediate
        ? {
            privacyStatus: "public" as const,
            selfDeclaredMadeForKids: false,
          }
        : {
            privacyStatus: "private" as const,
            publishAt: toRfc3339(job.publishAt),
            selfDeclaredMadeForKids: false,
          };

      if (job.immediate) {
        console.log("[youtube] publish now (public)");
      } else {
        console.log(`[youtube] schedule ${status.publishAt}`);
      }

      const res = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title,
            description: title,
            categoryId: "22",
          },
          status,
        },
        media: {
          body: fs.createReadStream(local.videoPath),
        },
      });

      const videoId = res.data.id;
      if (!videoId) {
        throw new Error("YouTube upload succeeded but returned no video id");
      }

      await uploadThumbnail(youtube, videoId, local.coverPath);

      const url = `https://youtube.com/shorts/${videoId}`;
      console.log(
        job.immediate
          ? `[youtube] published → ${url}`
          : `[youtube] scheduled → ${url}`,
      );
      return { url };
    } finally {
      await disposeLocalMedia(local);
    }
  },
};
