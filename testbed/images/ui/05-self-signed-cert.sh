#!/bin/sh
set -e
[ -f /etc/pki/nginx/fullchain.pem ] && exit 0
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -subj "/CN=${ADMIN_MAIN_DOMAIN_ADDRESS:-localhost}" \
  -addext "subjectAltName=DNS:${ADMIN_MAIN_DOMAIN_ADDRESS:-localhost},DNS:localhost,IP:127.0.0.1" \
  -keyout /etc/pki/nginx/privkey.pem -out /etc/pki/nginx/fullchain.pem 2>/dev/null
