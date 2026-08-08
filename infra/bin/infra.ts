#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import * as path from "node:path";
import { MediaStack } from "../lib/media-stack";

const app = new cdk.App();

const keysDir = path.join(__dirname, "..", "keys");
const publicKeyPemPath = path.join(keysDir, "cloudfront_public.pem");

new MediaStack(app, "TalkingHeadMedia", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  description: "Talking Head private S3 + CloudFront (OAC, signed URLs)",
  publicKeyPemPath,
  corsOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://yap-cut.vercel.app",
  ],
  tags: {
    Project: "talking-head",
    Stack: "media",
  },
});
