/**
 * Re-run create pipeline for a stuck processing project.
 * Usage: npx tsx --env-file=.env scripts/retry-create-pipeline.ts <projectId>
 */
import { runCreatePipeline } from "../src/server/create/run-create-pipeline";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Usage: retry-create-pipeline.ts <projectId>");
  process.exit(1);
}

console.log("Retrying create pipeline for", projectId);
runCreatePipeline(projectId)
  .then(() => {
    console.log("Pipeline finished");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Pipeline threw:", err);
    process.exit(1);
  });
