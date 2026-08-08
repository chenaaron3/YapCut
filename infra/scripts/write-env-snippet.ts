#!/usr/bin/env npx tsx
/**
 * After deploy, print (or append) app .env lines from cdk-outputs.json + local private key.
 *
 *   npx cdk deploy -O cdk-outputs.json
 *   npx tsx scripts/write-env-snippet.ts
 *   npx tsx scripts/write-env-snippet.ts --write
 */
import * as fs from "node:fs";
import * as path from "node:path";

const stackName = "TalkingHeadMedia";
const keysDir = path.join(__dirname, "..", "keys");
const privatePath = path.join(keysDir, "cloudfront_private.pem");
const outputsPath = path.join(__dirname, "..", "cdk-outputs.json");
const rootEnv = path.join(__dirname, "..", "..", ".env");
const write = process.argv.includes("--write");

if (!fs.existsSync(outputsPath)) {
  console.error(
    "Missing cdk-outputs.json. Deploy with: npx cdk deploy -O cdk-outputs.json",
  );
  process.exit(1);
}

if (!fs.existsSync(privatePath)) {
  console.error("Missing private key at", privatePath);
  process.exit(1);
}

const outputs = JSON.parse(fs.readFileSync(outputsPath, "utf8")) as Record<
  string,
  Record<string, string>
>;
const stack = outputs[stackName];
if (!stack) {
  console.error(`No outputs for stack ${stackName} in cdk-outputs.json`);
  process.exit(1);
}

const privateKeyEnv = fs
  .readFileSync(privatePath, "utf8")
  .trim()
  .replace(/\n/g, "\\n");

const snippet = [
  "# --- Talking Head media (from CDK TalkingHeadMedia) ---",
  `AWS_REGION=${stack.BucketRegion}`,
  `AWS_S3_BUCKET=${stack.BucketName}`,
  `CLOUDFRONT_DOMAIN=${stack.CloudFrontDomain}`,
  `CLOUDFRONT_KEY_PAIR_ID=${stack.CloudFrontKeyPairId}`,
  `CLOUDFRONT_PRIVATE_KEY="${privateKeyEnv}"`,
  "# Attach AppMediaPolicyArn to the IAM user behind AWS_ACCESS_KEY_ID for least privilege:",
  `# APP_MEDIA_POLICY_ARN=${stack.AppMediaPolicyArn}`,
  "",
].join("\n");

if (write) {
  const existing = fs.existsSync(rootEnv)
    ? fs.readFileSync(rootEnv, "utf8")
    : "";
  const marker = "# --- Talking Head media (from CDK TalkingHeadMedia) ---";
  let next: string;
  if (existing.includes(marker)) {
    next = existing.slice(0, existing.indexOf(marker)).replace(/\s+$/, "\n\n") + snippet;
  } else {
    next =
      existing.replace(/\s+$/, "") +
      (existing.length ? "\n\n" : "") +
      snippet;
  }
  fs.writeFileSync(rootEnv, next);
  console.log("Updated", rootEnv);
} else {
  process.stdout.write(snippet);
}
