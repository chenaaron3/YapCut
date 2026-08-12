# Talking Head media infra (CDK)

Private **S3** bucket + **CloudFront** (OAC) with **signed URLs** in `us-east-1`.

| Path | Use |
|------|-----|
| Presigned PUT → S3 | Uploads from browser / server |
| CloudFront signed GET | Playback / downloads (cheaper egress) |

## Prerequisites

- AWS credentials with rights to deploy CloudFormation / S3 / CloudFront / IAM
- OpenSSL (`ensure-signing-keys`)
- Node 20+

## Deploy

```bash
cd infra
npm install
npx tsx scripts/ensure-signing-keys.ts   # creates gitignored keys/
npx cdk bootstrap aws://$AWS_ACCOUNT/us-east-1
npx cdk deploy TalkingHeadMedia -O cdk-outputs.json
npx tsx scripts/write-env-snippet.ts --write   # appends to ../.env
```

Signing **private** key never goes into CloudFormation — only the public key is uploaded to CloudFront. Keep `infra/keys/` out of git.

## Outputs → env

| Output | App env |
|--------|---------|
| `BucketName` | `AWS_S3_BUCKET` |
| `BucketRegion` | `AWS_REGION` |
| `CloudFrontDomain` | `CLOUDFRONT_DOMAIN` |
| `CloudFrontDistributionId` | `CLOUDFRONT_DISTRIBUTION_ID` |
| `CloudFrontKeyPairId` | `CLOUDFRONT_KEY_PAIR_ID` |
| (local PEM) | `CLOUDFRONT_PRIVATE_KEY` |
| `AppMediaPolicyArn` | Attach to app IAM user |

## CORS

Default allowed origins: `http://localhost:3000`, `http://127.0.0.1:3000`.  
Add your Vercel URL in `bin/infra.ts` before production uploads from the browser.

## Remotion Lambda (export)

App export uses Remotion Lambda (separate from this CDK stack). One-time setup:

1. Follow https://www.remotion.dev/docs/lambda/setup (role `remotion-lambda-role`, user policy). Prefer a dedicated IAM user — `talking-head-app` is too narrow for deploy.
2. From repo root: `npm run remotion:deploy` → paste printed `REMOTION_*` vars into `.env` / Vercel.
3. Export writes a public MP4 into the Remotion Lambda bucket; Download uses that S3 URL directly (no copy into the media bucket).
