FROM alpine:3.20 AS manifest
RUN apk add --no-cache openssl
COPY certbear-testbed.yaml.tpl /tpl
RUN openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=sample.certbear-test.local" \
      -keyout /key.pem -out /crt.pem 2>/dev/null && \
    sed -e "s|@TLS_CRT@|$(base64 -w0 /crt.pem)|" -e "s|@TLS_KEY@|$(base64 -w0 /key.pem)|" /tpl > /certbear-testbed.yaml

FROM rancher/k3s:v1.31.4-k3s1
# k3s 는 이 폴더의 매니페스트를 기동 시 자동 적용한다 (named volume 최초 생성 때 이미지 내용이 복사됨)
COPY --from=manifest /certbear-testbed.yaml /var/lib/rancher/k3s/server/manifests/certbear-testbed.yaml
