import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// S3 Bucket voor hosting
const bucket = new aws.s3.Bucket("staticSiteBucket", {
    website: {
        indexDocument: "index.html",
    }
});

const deploymentSettings = new pulumiservice.deploymentSettings(" deploymentSettings", ){
    project: pulumi.mijn-test-Project
    github: {
        deployCommits: true,
        previewPulRequest: false,
        pullRequestTemplate: false,
        repository: "simonerebecca/test"
    }

// Bucket Policy voor publieke toegang
const bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
    bucket: bucket.id,
    policy: pulumi.all([bucket.arn]).apply(([arn]) => JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: "*",
            Action: "s3:GetObject",
            Resource: `${arn}/*`,
        }],
    })),
});

// CloudFront distributie voor CDN en HTTPS
const cdn = new aws.cloudfront.Distribution("cdnDistribution", {
    origins: [{
        domainName: bucket.websiteEndpoint,
        originId: bucket.id,
        customOriginConfig: {
            originProtocolPolicy: "http-only",
            httpPort: 80,
            httpsPort: 443,
            originSslProtocols: ["TLSv1.2"],
        }
    }],
    enabled: true,
    defaultRootObject: "index.html",
    defaultCacheBehavior: {
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD"],
        cachedMethods: ["GET", "HEAD"],
        targetOriginId: bucket.id,
        forwardedValues: {
            queryString: false,
            cookies: { forward: "none" },
        }
    },
    viewerCertificate: {
        cloudfrontDefaultCertificate: true,
    },
});

// Exporteer de URL's
export const s3Url = bucket.websiteEndpoint;
export const cloudfrontUrl = cdn.domainName;
