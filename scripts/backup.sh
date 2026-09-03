#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:-}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/mugful-$TIMESTAMP.sql.gz"
ENCRYPTED_FILE="$BACKUP_FILE.enc"

log() { printf '[backup] %s\n' "$*"; }

if ! command -v docker >/dev/null 2>&1; then echo "docker required" >&2; exit 1; fi

log "Creating database backup: $BACKUP_FILE"

# pg_dump via compose postgres service; fallback to DATABASE_URL if compose not running
if docker compose -f "$ROOT_DIR/compose.yaml" ps --status running 2>/dev/null | grep -q postgres; then
  docker compose -f "$ROOT_DIR/compose.yaml" exec -T postgres pg_dump -U "${POSTGRES_USER:?}" -d "${POSTGRES_DB:?}" | gzip -9 > "$BACKUP_FILE"
else
  if [[ -z "${DATABASE_URL:-}" ]]; then echo "DATABASE_URL not set and postgres not running" >&2; exit 1; fi
  # Use pg_dump via docker image to avoid local dependency
  docker run --rm -i postgres:17.10-bookworm pg_dump "$DATABASE_URL" | gzip -9 > "$BACKUP_FILE"
fi

if [[ -n "$ENCRYPTION_KEY_FILE" && -f "$ENCRYPTION_KEY_FILE" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    openssl enc -aes-256-cbc -salt -pbkdf2 -in "$BACKUP_FILE" -out "$ENCRYPTED_FILE" -pass "file:$ENCRYPTION_KEY_FILE"
    shred -u "$BACKUP_FILE" 2>/dev/null || rm -f "$BACKUP_FILE"
    BACKUP_FILE="$ENCRYPTED_FILE"
    log "Encrypted backup: $BACKUP_FILE (AES-256-CBC, PBKDF2)"
  else
    log "WARNING: openssl not found; backup left unencrypted at $BACKUP_FILE"
  fi
else
  log "NOTE: BACKUP_ENCRYPTION_KEY_FILE not set; backup left unencrypted. Set it for production (chmod 600)."
fi

chmod 600 "$BACKUP_FILE" 2>/dev/null || true

# Rotation: keep daily backups for RETENTION_DAYS, delete older
log "Rotating backups older than ${RETENTION_DAYS}d in $BACKUP_DIR"
find "$BACKUP_DIR" -type f -name "mugful-*.sql.gz*" -mtime +"$RETENTION_DAYS" -print -delete 2>/dev/null || true

log "Backup complete: $BACKUP_FILE"
log "Verify with: gzip -dc $BACKUP_FILE | head  (or openssl enc -d ... | gzip -dc | head if encrypted)"
log "Offsite copy: rsync -av --chmod=600 $BACKUP_FILE <offsite>:mugful-backups/  (or rclone/s3 sync per runbook)"
