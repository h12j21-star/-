#!/bin/bash
set -e

CERT_DIR=/etc/certbear-test
if [ ! -f "$CERT_DIR/server.crt" ]; then
  mkdir -p "$CERT_DIR"
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -subj "/CN=$(hostname)" -addext "subjectAltName=DNS:$(hostname),DNS:localhost" \
    -keyout "$CERT_DIR/server.key" -out "$CERT_DIR/server.crt" 2>/dev/null
fi

start-web-server.sh

cd /opt/certbear-agent
# 이미 있으면 admin 의 CONFIG_UPDATE 결과일 수 있으므로 덮어쓰지 않는다
if [ ! -f agent-config.json ]; then
  cat > agent-config.json <<JSON
{
  "adminAddress": "${ADMIN_ADDRESS}",
  "runtimeEnv": "dev",
  "certScanRoots": ["${CERT_DIR}"],
  "fileExtensions": [".crt", ".cert", ".pem", ".jks", ".der", ".p12", ".pfx"],
  "webServerConfigRoots": ${WEB_CONFIG_ROOTS},
  "enableDiscovery": true,
  "enablePortScanFallback": true,
  "isScanner": false
}
JSON
fi

mkdir -p logs
touch logs/master.log logs/certbear-agent.log
tail -qF logs/master.log logs/certbear-agent.log &

# master 는 등록 거부(예: 라이선스 미등록 LICENSE_BLOCKED) 같은 치명 오류면 종료한다.
# 컨테이너(웹서버)는 그대로 두고 30초 뒤 다시 띄워, 원인이 풀리면 자동으로 등록되게 한다.
trap 'kill -TERM "$child" 2>/dev/null; wait "$child"; exit 0' TERM INT
while true; do
  ./certbear-master -a -c agent-config.json &
  child=$!
  wait "$child" && code=0 || code=$?
  echo "[testbed] certbear-master exited (code=$code) — retrying in 30s"
  sleep 30 &
  wait $!
done
