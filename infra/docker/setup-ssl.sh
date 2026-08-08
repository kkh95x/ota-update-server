#!/usr/bin/env bash
# Obtain Let's Encrypt certificates and start nginx with HTTPS.
# Run on the VPS as root from infra/docker:
#   bash setup-ssl.sh
#
# Prerequisites: DNS for release.mod-syria.org → this server, port 80 reachable.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DOMAIN="${NGINX_SSL_DOMAIN:-release.mod-syria.org}"
EMAIL="${CERTBOT_EMAIL:-}"

if [[ -z "$EMAIL" ]]; then
  echo "Set CERTBOT_EMAIL for Let's Encrypt expiry notices, e.g.:"
  echo "  CERTBOT_EMAIL=you@example.com bash setup-ssl.sh"
  exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "Installing certbot..."
  apt-get update && apt-get install -y certbot
fi

echo "Stopping nginx container so certbot can use port 80..."
docker compose stop nginx || true

if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  certbot certonly --standalone --non-interactive --agree-tos \
    -m "$EMAIL" -d "$DOMAIN"
else
  echo "Certificate already exists at /etc/letsencrypt/live/${DOMAIN}/"
fi

echo "Starting nginx with HTTPS overlay..."
docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d nginx

echo ""
echo "HTTPS ready: https://${DOMAIN}/admin/login"
echo "Renewal: certbot renew (stop nginx first, or use webroot plugin)."
