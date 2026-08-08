import { desc, eq } from "drizzle-orm";

import { db } from "../src/server/db";
import { assets, projects, transcripts } from "../src/server/db/schema";

async function main() {
  const recent = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt))
    .limit(5);

  for (const p of recent) {
    console.log("--- PROJECT ---");
    console.log(
      JSON.stringify(
        {
          id: p.id,
          status: p.status,
          failureReason: p.failureReason,
          title: p.title,
          updatedAt: p.updatedAt,
        },
        null,
        2,
      ),
    );
    const as = await db.select().from(assets).where(eq(assets.projectId, p.id));
    console.log(
      "assets",
      JSON.stringify(
        as.map((a) => ({
          id: a.id,
          s3Key: a.s3Key,
          durationSec: a.durationSec,
          filename: a.originalFilename,
          contentType: a.contentType,
        })),
        null,
        2,
      ),
    );
    for (const a of as) {
      const ts = await db
        .select()
        .from(transcripts)
        .where(eq(transcripts.assetId, a.id));
      console.log(
        "transcripts for",
        a.id,
        JSON.stringify(
          ts.map((t) => ({
            id: t.id,
            status: t.status,
            wordCount: Array.isArray(t.words) ? t.words.length : null,
            raw: t.raw,
          })),
          null,
          2,
        ),
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
