#!/usr/bin/env npx tsx
/**
 * Ensures RSA keypair exists for CloudFront signed URLs.
 * Keys are gitignored under infra/keys/.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const keysDir = path.join(__dirname, "..", "keys");
const privatePath = path.join(keysDir, "cloudfront_private.pem");
const publicPath = path.join(keysDir, "cloudfront_public.pem");

fs.mkdirSync(keysDir, { recursive: true });

if (fs.existsSync(privatePath) && fs.existsSync(publicPath)) {
  console.log("Signing keys already present in infra/keys/");
  process.exit(0);
}

console.log("Generating CloudFront signing keypair…");
execFileSync("openssl", ["genrsa", "-out", privatePath, "2048"], {
  stdio: "inherit",
});
fs.chmodSync(privatePath, 0o600);
execFileSync(
  "openssl",
  ["rsa", "-pubout", "-in", privatePath, "-out", publicPath],
  { stdio: "inherit" },
);
console.log("Wrote", privatePath, "and", publicPath);
