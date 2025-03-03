import pulumi
import pulumi_aws as aws

# Maak een S3 bucket
bucket = aws.s3.Bucket("static-site-bucket", website=aws.s3.BucketWebsiteArgs(
    index_document="index.html"
))

# Stel bucket policy in zodat de bestanden openbaar toegankelijk zijn
bucket_policy = aws.s3.BucketPolicy("bucket-policy",
    bucket=bucket.id,
    policy=pulumi.Output.all(bucket.arn).apply(lambda arn: f'''{{
        "Version": "2012-10-17",
        "Statement": [{{
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "{arn}/*"
        }}]
    }}''')
)

# Maak een CloudFront-distributie voor caching en SSL
cdn = aws.cloudfront.Distribution("cdn",
    origins=[aws.cloudfront.DistributionOriginArgs(
        domain_name=bucket.bucket_regional_domain_name,
        origin_id=bucket.id
    )],
    enabled=True,
    default_root_object="index.html",
    default_cache_behavior=aws.cloudfront.DistributionDefaultCacheBehaviorArgs(
        viewer_protocol_policy="redirect-to-https",
        allowed_methods=["GET", "HEAD"],
        cached_methods=["GET", "HEAD"],
        target_origin_id=bucket.id,
        forwarded_values=aws.cloudfront.DistributionForwardedValuesArgs(
            query_string=False,
            cookies=aws.cloudfront.DistributionForwardedValuesCookiesArgs(forward="none"),
        ),
    ),
    viewer_certificate=aws.cloudfront.DistributionViewerCertificateArgs(
        cloudfront_default_certificate=True
    ),
)

# Exporteer de URL's
pulumi.export("s3_url", bucket.website_endpoint)
pulumi.export("cloudfront_url", cdn.domain_name)
