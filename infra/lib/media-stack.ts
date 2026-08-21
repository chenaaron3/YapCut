import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import * as fs from "node:fs";

/**
 * CloudFront Function: answer OPTIONS without a signed URL.
 * Reflect any Origin — media GETs are authorized by the signed URL, not Origin.
 * (Remotion Lambda site origin is not in the app allowlist.)
 */
function corsOptionsFunctionSource(): string {
  return `function handler(event) {
  var request = event.request;
  if (request.method !== 'OPTIONS') return request;
  var origin = request.headers.origin ? request.headers.origin.value : '';
  var headers = {
    'access-control-allow-methods': { value: 'GET, HEAD, OPTIONS' },
    'access-control-allow-headers': { value: '*' },
    'access-control-max-age': { value: '86400' },
    'access-control-expose-headers': { value: 'ETag, Content-Length, Content-Range, Accept-Ranges' },
    'vary': { value: 'Origin' }
  };
  if (origin) {
    headers['access-control-allow-origin'] = { value: origin };
  } else {
    headers['access-control-allow-origin'] = { value: '*' };
  }
  return {
    statusCode: 204,
    statusDescription: 'No Content',
    headers: headers
  };
}
`;
}

export interface MediaStackProps extends cdk.StackProps {
  /** Absolute path to CloudFront public key PEM (PKCS#8). */
  readonly publicKeyPemPath: string;
  /** Extra browser origins allowed to PUT via S3 CORS (presigned uploads). */
  readonly corsOrigins?: string[];
}

/**
 * Private media bucket + CloudFront (OAC) with signed-URL key group.
 * Uploads: presigned PUT → S3. Reads: CloudFront signed URLs.
 *
 * Private signing key stays local (`infra/keys/`) and is copied into app `.env`
 * by `scripts/write-env-snippet.ts` — never embedded in the CloudFormation template.
 */
export class MediaStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly keyPairId: string;

  constructor(scope: Construct, id: string, props: MediaStackProps) {
    super(scope, id, props);

    const publicKeyPem = fs.readFileSync(props.publicKeyPemPath, "utf8").trim();

    const corsOrigins = props.corsOrigins ?? [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];

    this.bucket = new s3.Bucket(this, "Assets", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      // Dev-friendly: empty + delete on stack destroy. Flip for prod.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: corsOrigins,
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
    });

    const publicKey = new cloudfront.PublicKey(this, "SigningPublicKey", {
      encodedKey: publicKeyPem,
      comment: "Talking Head media signed URL key",
    });

    const keyGroup = new cloudfront.KeyGroup(this, "SigningKeyGroup", {
      items: [publicKey],
      comment: "Talking Head signed URLs",
    });

    this.keyPairId = publicKey.publicKeyId;

    // Remotion MediaPlayer + Lambda hard-mask canvas need CORS on CF responses.
    // Auth is the signed URL; allow any browser Origin (incl. remotionlambda S3 site).
    // S3 bucket CORS above stays app-origin-only for presigned PUTs.
    const corsResponseHeaders = new cloudfront.ResponseHeadersPolicy(
      this,
      "MediaCorsHeaders",
      {
        comment: "Signed GET: any Origin (editor, preview, Remotion Lambda)",
        corsBehavior: {
          accessControlAllowCredentials: false,
          accessControlAllowHeaders: ["*"],
          accessControlAllowMethods: ["GET", "HEAD", "OPTIONS"],
          accessControlAllowOrigins: ["*"],
          accessControlExposeHeaders: [
            "ETag",
            "Content-Length",
            "Content-Range",
            "Accept-Ranges",
          ],
          accessControlMaxAge: cdk.Duration.seconds(600),
          originOverride: true,
        },
      },
    );

    // Trusted key groups reject unsigned OPTIONS; answer preflight at the edge.
    const corsOptionsFn = new cloudfront.Function(this, "CorsOptionsFn", {
      comment: "Signed-URL CDN: answer CORS preflight without a signature",
      code: cloudfront.FunctionCode.fromInline(corsOptionsFunctionSource()),
    });

    this.distribution = new cloudfront.Distribution(this, "Cdn", {
      comment: "Talking Head media CDN",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        trustedKeyGroups: [keyGroup],
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        responseHeadersPolicy: corsResponseHeaders,
        functionAssociations: [
          {
            function: corsOptionsFn,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // Managed policy document the app IAM user/role should attach (least privilege).
    const appPolicy = new iam.ManagedPolicy(this, "AppMediaPolicy", {
      description: "Talking Head app: S3 media read/write + CloudFront invalidate",
      statements: [
        new iam.PolicyStatement({
          sid: "ObjectRW",
          actions: [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject",
            "s3:AbortMultipartUpload",
            "s3:ListMultipartUploadParts",
          ],
          resources: [this.bucket.arnForObjects("*")],
        }),
        new iam.PolicyStatement({
          sid: "BucketList",
          actions: ["s3:ListBucket", "s3:ListBucketMultipartUploads"],
          resources: [this.bucket.bucketArn],
        }),
        new iam.PolicyStatement({
          sid: "CloudFrontInvalidate",
          actions: ["cloudfront:CreateInvalidation"],
          resources: [
            `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${this.distribution.distributionId}`,
          ],
        }),
      ],
    });

    new cdk.CfnOutput(this, "BucketName", {
      value: this.bucket.bucketName,
      description: "S3 media bucket name → AWS_S3_BUCKET",
    });

    new cdk.CfnOutput(this, "BucketRegion", {
      value: this.region,
      description: "→ AWS_REGION",
    });

    new cdk.CfnOutput(this, "CloudFrontDomain", {
      value: this.distribution.distributionDomainName,
      description: "→ CLOUDFRONT_DOMAIN (no https://)",
    });

    new cdk.CfnOutput(this, "CloudFrontDistributionId", {
      value: this.distribution.distributionId,
      description: "→ CLOUDFRONT_DISTRIBUTION_ID (SFX seed CDN invalidate)",
    });

    new cdk.CfnOutput(this, "CloudFrontKeyPairId", {
      value: this.keyPairId,
      description: "→ CLOUDFRONT_KEY_PAIR_ID",
    });

    new cdk.CfnOutput(this, "AppMediaPolicyArn", {
      value: appPolicy.managedPolicyArn,
      description: "Attach to the IAM principal used by the app",
    });
  }
}
