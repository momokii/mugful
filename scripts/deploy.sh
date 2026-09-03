#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/compose.yaml"
COMPOSE_PROD_FILE="$ROOT_DIR/compose.prod.yaml"
ENV_FILE="$ROOT_DIR/.env"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
PREVIOUS_TAG_FILE="$BACKUP_DIR/.previous-image-tag"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

log() { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy:error] %s\n' "$*" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] || fail "Missing $ENV_FILE. Copy .env.example and fill production values with restrictive permissions (chmod 600)."

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

require_env() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    fail "Required environment variable $var is not set in $ENV_FILE"
  fi
}

require_secret_len() {
  local var="$1"
  local min="$2"
  local val="${!var:-}"
  if [[ ${#val} -lt $min ]]; then
    fail "$var must be at least $min characters (got ${#val})"
  fi
}

log "Validating environment..."

for v in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD POSTGRES_PORT DATABASE_URL API_HOST API_PORT API_INTERNAL_ORIGIN WEB_ORIGIN SESSION_TOKEN_PEPPER CSRF_SECRET RATE_LIMIT_PRINCIPAL_PEPPER IDENTITY_TOKEN_PEPPER INVITE_TOKEN_PEPPER SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_FROM DOCKER_USER IMAGE_TAG TRAEFIK_HOST; do
  require_env "$v"
done

for v in SESSION_TOKEN_PEPPER CSRF_SECRET RATE_LIMIT_PRINCIPAL_PEPPER IDENTITY_TOKEN_PEPPER INVITE_TOKEN_PEPPER; do
  require_secret_len "$v" 32
done

if [[ "$DATABASE_URL" != postgresql://* && "$DATABASE_URL" != postgres://* ]]; then
  fail "DATABASE_URL must be a postgresql:// or postgres:// URL"
fi

if [[ "$NODE_ENV" != "production" ]]; then
  log "WARNING: NODE_ENV is '$NODE_ENV' (expected 'production' for deployment)"
fi

if [[ "${REGISTRATION_DEFAULT_ENABLED:-false}" == "true" && "${NEXT_PUBLIC_REGISTRATION_ENABLED:-false}" != "true" ]]; then
  log "NOTE: REGISTRATION_DEFAULT_ENABLED=true but NEXT_PUBLIC_REGISTRATION_ENABLED is not true (web form will remain hidden)"
fi

if [[ "$IMAGE_TAG" == "latest" ]]; then
  fail "IMAGE_TAG must not be 'latest'. Pin a semantic version (vX.Y.Z) or commit SHA."
fi

if ! command -v docker >/dev/null 2>&1; then fail "docker is required"; fi
if ! docker compose version >/dev/null 2>&1; then fail "docker compose v2 is required"; fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

PREVIOUS_TAG="$(cat "$PREVIOUS_TAG_FILE" 2>/dev/null || echo "")"
if [[ -n "$PREVIOUS_TAG" ]]; then
  log "Previous release tag: $PREVIOUS_TAG (retained for rollback)"
fi

DESTRUCTIVE_PATTERN='(DROP\s+TABLE|DROP\s+COLUMN|ALTER\s+TABLE.*DROP)'
if grep -R -E -q "$DESTRUCTIVE_PATTERN" "$ROOT_DIR/apps/api/drizzle" 2>/dev/null; then
  log "Detected potentially destructive migration statements."
  if [[ "${ALLOW_DESTRUCTIVE_MIGRATIONS:-}" != "true" ]]; then
    fail "Destructive migration detected. Re-run with ALLOW_DESTRUCTIVE_MIGRATIONS=true after explicit operator confirmation."
  fi
fi

log "Selected release: IMAGE_TAG=$IMAGE_TAG"
log "Creating pre-deploy backup..."
if [[ -x "$ROOT_DIR/scripts/backup.sh" ]]; then
  "$ROOT_DIR/scripts/backup.sh" || fail "Pre-deploy backup failed. Aborting."
else
  log "WARNING: scripts/backup.sh not executable or missing; skipping backup (not recommended for production)"
fi

log "Pulling images for $IMAGE_TAG..."
DOCKER_USER="$DOCKER_USER" IMAGE_TAG="$IMAGE_TAG" TRAEFIK_HOST="$TRAEFIK_HOST" docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" pull || fail "Image pull failed"

log "Running database migrations (explicit, not on startup)..."
# Use a one-off container with the api image to run migrations
DOCKER_USER="$DOCKER_USER" IMAGE_TAG="$IMAGE_TAG" TRAEFIK_HOST="$TRAEFIK_HOST" docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" run --rm api pnpm --filter @mugful/api db:migrate || {
  fail "Migrations failed. Not starting new stack."
}

log "Starting stack..."
DOCKER_USER="$DOCKER_USER" IMAGE_TAG="$IMAGE_TAG" TRAEFIK_HOST="$TRAEFIK_HOST" docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" up -d

log "Waiting for health checks (timeout ${HEALTH_TIMEOUT}s)..."
elapsed=0
until curl -fsS http://127.0.0.1:3001/health/live >/dev/null 2>&1 && curl -fsS http://127.0.0.1:3001/health/ready >/dev/null 2>&1; do
  if (( elapsed >= HEALTH_TIMEOUT )); then
    log "Health checks failed. Attempting rollback..."
    if [[ -n "$PREVIOUS_TAG" ]]; then
      IMAGE_TAG="$PREVIOUS_TAG" DOCKER_USER="$DOCKER_USER" TRAEFIK_HOST="$TRAEFIK_HOST" docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" up -d || true
    fi
    fail "Health checks did not pass within ${HEALTH_TIMEOUT}s"
  fi
  sleep 5
  elapsed=$((elapsed+5))
done

log "Health checks passed."
printf '%s\n' "$IMAGE_TAG" > "$PREVIOUS_TAG_FILE"
chmod 600 "$PREVIOUS_TAG_FILE" 2>/dev/null || true

log "Deployment complete: $IMAGE_TAG"
log "To rollback manually: IMAGE_TAG=$PREVIOUS_TAG $0  (or) scripts/restore.sh <backup-file>"
