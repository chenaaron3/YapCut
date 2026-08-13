import { pathToFileURL } from "node:url";

import { eq } from "drizzle-orm";

import type { PlatformId } from "~/domain/schedule";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { executeScheduleRun } from "~/schedule/execute-run";
import { createLocalPublishers } from "~/schedule/local";

function parseArgs(argv: string[]) {
  let userEmail: string | undefined =
    process.env.SCHEDULE_USER_EMAIL ?? undefined;
  let projectId: string | undefined;
  let platformsOverride: PlatformId[] | undefined;

  const rest = [...argv];
  const take = (flag: string): string | undefined => {
    const i = rest.indexOf(flag);
    if (i < 0) return undefined;
    const v = rest[i + 1];
    rest.splice(i, 2);
    return v;
  };

  const email = take("--user");
  if (email) userEmail = email;
  const project = take("--project");
  if (project) projectId = project;

  const platformsFlagIdx = rest.indexOf("--platforms");
  if (platformsFlagIdx >= 0) {
    const values: string[] = [];
    let i = platformsFlagIdx + 1;
    while (i < rest.length && !rest[i]!.startsWith("--")) {
      values.push(rest[i]!);
      i++;
    }
    platformsOverride = values.map((v) => v.toLowerCase() as PlatformId);
    rest.splice(platformsFlagIdx, i - platformsFlagIdx);
  }

  if (rest.length > 0) {
    throw new Error(
      `Unknown args: ${rest.join(" ")}\n` +
        "Usage: npm run schedule -- [--user email] [--project id] [--platforms youtube instagram tiktok]",
    );
  }

  if (!userEmail) {
    throw new Error(
      "Pass --user you@example.com or set SCHEDULE_USER_EMAIL",
    );
  }

  return { userEmail, projectId, platformsOverride };
}

async function resolveUserId(email: string): Promise<string> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!row) {
    throw new Error(`No user with email ${email}`);
  }
  return row.id;
}

export async function runSchedule(argv: string[]): Promise<void> {
  const { userEmail, projectId, platformsOverride } = parseArgs(argv);
  const userId = await resolveUserId(userEmail);
  await executeScheduleRun({
    userId,
    projectId,
    platformsOverride,
    createPublishers: createLocalPublishers,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  runSchedule(process.argv.slice(2))
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
