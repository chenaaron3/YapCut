import * as cdk from "aws-cdk-lib/core";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { MediaStack } from "../lib/media-stack";

function writeTempPublicKey(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "th-cf-key-"));
  const pub = path.join(dir, "public.pem");
  // Minimal valid-looking PEM for unit test (CloudFormation accepts string; deploy needs real key)
  const pem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAthVYGPynLjm2xbo9rxLD
placeholderplaceholderplaceholderplaceholderplaceholderplacehol
-----END PUBLIC KEY-----`;
  fs.writeFileSync(pub, pem);
  return pub;
}

test("MediaStack creates private bucket and signed CloudFront distribution", () => {
  const app = new cdk.App();
  const stack = new MediaStack(app, "TestMedia", {
    env: { account: "111111111111", region: "us-east-1" },
    publicKeyPemPath: writeTempPublicKey(),
  });
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        {
          ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" },
        },
      ],
    },
  });

  template.hasResourceProperties("AWS::CloudFront::Distribution", {
    DistributionConfig: {
      DefaultCacheBehavior: {
        TrustedKeyGroups: Match.anyValue(),
        ViewerProtocolPolicy: "https-only",
      },
    },
  });

  template.resourceCountIs("AWS::CloudFront::PublicKey", 1);
  template.resourceCountIs("AWS::CloudFront::KeyGroup", 1);
});
