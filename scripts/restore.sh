#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:-}"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-file.sql.gz | backup-file.sql.gz.enc> [--yes]" >&2
  echo "  Restores a backup created by scripts/backup.sh." >&2
  echo "  Requires explicit confirmation unless --yes is given." >&2
  echo "  Deletion metadata (revoked_at, deletion_grace_ends_at) is preserved in the dump and reapplied on restore." >&2
  echo "  After restore, expired grace periods must be honored by the retention job (see docs/ARCHITECTURE.md#backup-and-recovery)." >&2
  exit 1
fi

BACKUP_FILE="$1"
CONFIRM="${2:-}"

if [[ ! -f "$BACKUP_FILE" ]]; then echo "Backup file not found: $BACKUP_FILE" >&2; exit 1; fi
if [[ -f "$ENV_FILE" ]]; then set -a; source "$ENV_FILE"; set +a; fi

if [[ "$CONFIRM" != "--yes" ]]; then
  echo "WARNING: This will REPLACE data in database ${POSTGRES_DB:-mugful} on ${POSTGRES_HOST:-127.0.0.1}:${POSTGRES_PORT:-5432}" >&2
  read -r -p "Type 'yes' to continue: " ans
  [[ "$ans" == "yes" ]] || { echo "Aborted." >&2; exit 1; }
fi

log() { printf '[restore] %s\n' "$*"; }

DECRYPTED=""
cleanup() { [[ -n "$DECRYPTED" && -f "$DECRYPTED" ]] && rm -f "$DECRYPTED" || true; }
trap cleanup EXIT

INPUT_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.enc ]]; then
  if [[ -z "$ENCRYPTION_KEY_FILE" || ! -f "$ENCRYPTION_KEY_FILE" ]]; then echo "Encrypted backup requires BACKUP_ENCRYPTION_KEY_FILE" >&2; exit 1; fi
  if ! command -v openssl >/dev/null 2>&1; then echo "openssl required to decrypt" >&2; exit 1; fi
  DECRYPTED="$(mktemp)"
  openssl enc -d -aes-256-cbc -pbkdf2 -in "$BACKUP_FILE" -out "$DECRYPTED" -pass "file:$ENCRYPTION_KEY_FILE"
  INPUT_FILE="$DECRYPTED"
  log "Decrypted $BACKUP_FILE"
fi

# Decompress on the fly and restore
if [[ "$INPUT_FILE" == *.gz ]]; then
  DECOMPRESSED="$(mktemp)"
  gzip -dc "$INPUT_FILE" > "$DECOMPRESSED"
  INPUT_FILE="$DECOMPRESSED"
  trap 'rm -f "$DECRYPTED" "$DECOMPRESSED" 2>/dev/null || true' EXIT
fi

log "Restoring $BACKUP_FILE to ${POSTGRES_DB:-mugful}..."
# Prefer compose exec if running; else use DATABASE_URL via docker pg image
if docker compose -f "$ROOT_DIR/compose.yaml" ps --status running 2>/dev/null | grep -q postgres; then
  # Terminate other connections, then restore
  docker compose -f "$ROOT_DIR/compose.yaml" exec -T postgres psql -U "${POSTGRES_USER:?}" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${POSTGRES_DB:?}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
  docker compose -f "$ROOT_DIR/compose.yaml" exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null
  cat "$INPUT_FILE" | docker compose -f "$ROOT_DIR/compose.yaml" exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null
else
  if [[ -z "${DATABASE_URL:-}" ]]; then echo "DATABASE_URL not set and postgres not running" >&2; exit 1; fi
  # Use a temporary container for restore
  cat "$INPUT_FILE" | docker run --rm -i --network host postgres:17.10-bookworm psql "$DATABASE_URL" >/dev/null
fi

log "Restore complete. Verifying..."
if docker compose -f "$ROOT_DIR/compose.yaml" ps --status running 2>/dev/null | grep -q postgres; then
  docker compose -f "$ROOT_DIR/compose.yaml" exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" >/dev/null && log "Verification query succeeded"
fi

log "NOTE: If backup retention re-introduces soft-deleted rows, run the retention/deletion job to reapply grace-period expiry (see ARCHITECTURE.md)."
log "Done. Restart the stack: docker compose -f compose.yaml -f compose.prod.yaml up -d && curl -fsS http://127.0.0.1:3001/health/ready"
