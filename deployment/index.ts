import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const { execSync } = require("child_process");

try {
  execSync("npm install @pulumi/pulumiservice", { stdio: "inherit" });
  console.log("Package geïnstalleerd!");
} catch (error) {
  console.error("Fout bij het installeren van de package:", error);
}

import * as service from "@pulumi/pulumiservice";

const provider = new aws.Provider("myProvider", {
    accessKey: process.env.AWS_ACCESS_KEY_ID,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const settings = new service.DeploymentSettings("deploy-settings", {
    organization: "simonerebecca",
    project: "test-website",
    stack: "dev",
    github: {
        deployCommits: true,
        previewPullRequests: false,
        pullRequestTemplate: true,
        repository: "simonerebecca/test"
    },
    sourceContext: {
        git:{
            branch: "main"
        }},
});

// Maak een S3 bucket aan voor statische website hosting
const myBucket = new aws.s3.Bucket("myBucket", {
    website: {
        indexDocument: "index.html",
    },
});

const myBucketPublicAccessBlock = new aws.s3.BucketPublicAccessBlock("myBucketPublicAccessBlock", {
    bucket: myBucket.id,
    blockPublicAcls: false,
    blockPublicPolicy: false,
    ignorePublicAcls: false,
    restrictPublicBuckets: false,
});

const bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
    bucket: myBucket.id,
    policy: pulumi.output(myBucket.id).apply(id =>
        JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: "*",
                    Action: "s3:GetObject",
                    Resource: `arn:aws:s3:::${id}/*`,
                },
            ],
        })
    ),
});

// Upload index.html naar de S3 bucket
const indexHtml = new aws.s3.BucketObject("indexHtml", {
    bucket: myBucket.id, // Koppel het object aan de S3-bucket
    key: "index.html", // Bestandsnaam in de bucket
    source: new pulumi.asset.FileAsset("index.html"), // Bestand dat geüpload moet worden
    contentType: "text/html", // Zorg ervoor dat de browser het als HTML herkent
});

// CloudFront-distributie aanmaken voor de S3-bucket
const myDistribution = new aws.cloudfront.Distribution("myDistribution", {
    origins: [
        {
            domainName: myBucket.websiteEndpoint,
            originId: myBucket.arn,
            customOriginConfig: {
                originProtocolPolicy: "http-only",
                httpPort: 80,
                httpsPort: 443,
                originSslProtocols: ["TLSv1.2"],
            },
        },
    ],
    enabled: true,
    defaultRootObject: "index.html",
    defaultCacheBehavior: {
        targetOriginId: myBucket.arn,
        viewerProtocolPolicy: "allow-all",
        allowedMethods: ["GET", "HEAD"],
        cachedMethods: ["GET", "HEAD"],
        forwardedValues: {
            queryString: false,
            cookies: { forward: "none" },
        },
    },
    restrictions: {
        geoRestriction: {
            restrictionType: "none", // Geen beperkingen op geolocatie
            locations: [],
        },
    },
    viewerCertificate: {
        cloudfrontDefaultCertificate: true,
    },
});

// Exporteer de CloudFront URL
export const cloudfrontUrl = myDistribution.domainName;
