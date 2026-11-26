#!/bin/sh
# admin 은 클라우드 등록의 endpoint(경유 서버)로 TLS 릴레이한다 — Host·SNI 는 AWS 호스트 그대로라
# moto 가 호스트로 서비스를 가른다. 그래서 moto 를 443 TLS(--ssl, 자체서명)로 띄운다.
moto_server -H 0.0.0.0 -p 443 --ssl &
PID=$!
trap 'kill -TERM $PID' TERM INT
python /opt/certbear/seed.py || echo "[seed] failed — moto 는 계속 동작합니다"
wait $PID
