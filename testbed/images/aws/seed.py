"""moto 에 ACM 인증서 1개 + 그 인증서를 쓰는 ALB HTTPS 리스너 1개를 만든다."""
import datetime
import os
import time

import boto3
import urllib3
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

urllib3.disable_warnings()
REGION = os.environ.get("AWS_REGION", "ap-northeast-2")
DOMAIN = "app.certbear-test.local"


def client(name):
    return boto3.client(
        name,
        region_name=REGION,
        endpoint_url="https://localhost",
        verify=False,
        aws_access_key_id="testing",
        aws_secret_access_key="testing",
    )


def self_signed():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, DOMAIN)])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=30))
        .add_extension(x509.SubjectAlternativeName([x509.DNSName(DOMAIN)]), critical=False)
        .sign(key, hashes.SHA256())
    )
    return (
        cert.public_bytes(serialization.Encoding.PEM),
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        ),
    )


for _ in range(60):
    try:
        client("sts").get_caller_identity()
        break
    except Exception:
        time.sleep(1)

crt, key = self_signed()
arn = client("acm").import_certificate(Certificate=crt, PrivateKey=key)["CertificateArn"]

ec2 = client("ec2")
vpc_id = ec2.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])["Vpcs"][0]["VpcId"]
subnets = [s["SubnetId"] for s in ec2.describe_subnets(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])["Subnets"]][:2]

elb = client("elbv2")
lb_arn = elb.create_load_balancer(Name="certbear-test-alb", Subnets=subnets, Type="application")["LoadBalancers"][0]["LoadBalancerArn"]
tg_arn = elb.create_target_group(Name="certbear-test-tg", Protocol="HTTP", Port=80, VpcId=vpc_id)["TargetGroups"][0]["TargetGroupArn"]
elb.create_listener(
    LoadBalancerArn=lb_arn,
    Protocol="HTTPS",
    Port=443,
    Certificates=[{"CertificateArn": arn}],
    DefaultActions=[{"Type": "forward", "TargetGroupArn": tg_arn}],
)
print(f"[seed] ACM {arn}\n[seed] ALB {lb_arn}", flush=True)
