#!/usr/bin/env bash
# Generate secure secrets and write them to .env files.
# Usage (from repository root):
#   bash scripts/generate-env.sh
#   bash scripts/generate-env.sh --force   # overwrite existing .env files from .env.example first

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_ENV="$ROOT_DIR/.env"
ROOT_EXAMPLE="$ROOT_DIR/.env.example"
DOCKER_ENV="$ROOT_DIR/infra/docker/.env"
DOCKER_EXAMPLE="$ROOT_DIR/infra/docker/.env.example"
FORCE=false

if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_command openssl

random_alnum() {
  local length="${1:-32}"
  openssl rand -hex 64 | tr -dc 'A-Za-z0-9' | head -c "$length"
}

random_base64_secret() {
  openssl rand -base64 32 | tr -d '\n'
}

ensure_env_file() {
  local target="$1"
  local example="$2"
  if [[ ! -f "$example" ]]; then
    die "Missing template: $example"
  fi
  if [[ ! -f "$target" ]] || [[ "$FORCE" == true ]]; then
    cp "$example" "$target"
    log "Created $target from template"
  elif [[ ! -f "$target" ]]; then
    cp "$example" "$target"
    log "Created $target from template"
  fi
}

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=" "$file"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file"
    rm -f "${file}.bak"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

ensure_env_file "$ROOT_ENV" "$ROOT_EXAMPLE"
ensure_env_file "$DOCKER_ENV" "$DOCKER_EXAMPLE"

POSTGRES_PASSWORD="$(random_alnum 32)"
MINIO_ROOT_PASSWORD="$(random_alnum 32)"
AUTH_SECRET="$(random_base64_secret)"
CSRF_SECRET="$(random_base64_secret)"
ROLLOUT_HASH_SECRET="$(random_base64_secret)"

MINIO_ROOT_USER="minioadmin"
DATABASE_URL="postgresql://ota:${POSTGRES_PASSWORD}@localhost:5432/ota"

# infra/docker/.env
set_env_value "$DOCKER_ENV" "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"
set_env_value "$DOCKER_ENV" "MINIO_ROOT_PASSWORD" "$MINIO_ROOT_PASSWORD"
set_env_value "$DOCKER_ENV" "MINIO_ROOT_USER" "$MINIO_ROOT_USER"

# root .env
set_env_value "$ROOT_ENV" "DATABASE_URL" "$DATABASE_URL"
set_env_value "$ROOT_ENV" "AUTH_SECRET" "$AUTH_SECRET"
set_env_value "$ROOT_ENV" "CSRF_SECRET" "$CSRF_SECRET"
set_env_value "$ROOT_ENV" "ROLLOUT_HASH_SECRET" "$ROLLOUT_HASH_SECRET"
set_env_value "$ROOT_ENV" "S3_ACCESS_KEY_ID" "$MINIO_ROOT_USER"
set_env_value "$ROOT_ENV" "S3_SECRET_ACCESS_KEY" "$MINIO_ROOT_PASSWORD"

log ""
log "=== Secrets generated and written ==="
log "  $ROOT_ENV"
log "  $DOCKER_ENV"
log ""
log "Generated values (save securely - shown once):"
log "  POSTGRES_PASSWORD     = $POSTGRES_PASSWORD"
log "  MINIO_ROOT_PASSWORD   = $MINIO_ROOT_PASSWORD"
log "  MINIO_ROOT_USER       = $MINIO_ROOT_USER"
log "  AUTH_SECRET           = $AUTH_SECRET"
log "  CSRF_SECRET           = $CSRF_SECRET"
log "  ROLLOUT_HASH_SECRET   = $ROLLOUT_HASH_SECRET"
log "  DATABASE_URL          = postgresql://ota:***@localhost:5432/ota"
log ""
log "Next steps:"
log "  cd infra/docker && docker compose up -d postgres redis minio minio-init"
log "  cd ../.. && pnpm db:push && pnpm db:seed"
