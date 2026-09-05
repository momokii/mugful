#!/usr/bin/env bash
set -euo pipefail

run_id="auth-lifecycle-$(date +%s)-$$"
root_dir="$(GIT_MASTER=1 git rev-parse --show-toplevel)"
runtime_dir="$(mktemp -d)"
compose_file="$runtime_dir/compose.yaml"
environment_file="$runtime_dir/runtime.env"
api_log="$runtime_dir/api.log"
web_log="$runtime_dir/web.log"
web_next_env_backup="$runtime_dir/next-env.d.ts"
web_tsconfig_backup="$runtime_dir/tsconfig.json"
cleanup_receipt_path="${MUGFUL_LIFECYCLE_RECEIPT_PATH:-/tmp/${run_id}.cleanup-receipt}"
unused_port() { node -e 'require("node:net").createServer().listen(0,"127.0.0.1", function () { console.log(this.address().port); this.close(); })'; }
secret() { node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'; }
postgres_port="$(unused_port)"
mailpit_smtp_port="$(unused_port)"
mailpit_ui_port="$(unused_port)"
api_port="$(unused_port)"
web_port="$(unused_port)"
web_dist_dir=".next-${run_id}"

owned_process_groups=()
owned_pid=""

start_owned() {
  setsid "$@" &
  owned_pid="$!"
  owned_process_groups+=("$owned_pid")
}

stop_owned() {
  local process_group="$1"
  kill -TERM -- -"$process_group" 2>/dev/null || true
  wait "$process_group" 2>/dev/null || true
}

cleanup() {
  local status=$?
  local process_group
  local remaining=""
  for process_group in "${owned_process_groups[@]}"; do
    stop_owned "$process_group"
  done
  for process_group in "${owned_process_groups[@]}"; do
    remaining+="$(pgrep -g "$process_group" 2>/dev/null || true)"
  done
  printf 'owned_process_groups=%s\nremaining_processes=%s\n' "${owned_process_groups[*]}" "${remaining:-none}" > "$cleanup_receipt_path"
  docker compose --project-name "$run_id" --file "$compose_file" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$root_dir/apps/web/$web_dist_dir"
  cp "$web_next_env_backup" "$root_dir/apps/web/next-env.d.ts"
  cp "$web_tsconfig_backup" "$root_dir/apps/web/tsconfig.json"
  rm -rf "$runtime_dir"
  printf 'cleanup receipt: %s\n' "$cleanup_receipt_path"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

cat > "$compose_file" <<EOF
services:
  postgres:
    image: postgres:17.10-bookworm
    environment:
      POSTGRES_DB: mugful
      POSTGRES_PASSWORD: lifecycle-only-password
      POSTGRES_USER: mugful
    ports: ["127.0.0.1:${postgres_port}:5432"]
    volumes: ["postgres:/var/lib/postgresql/data"]
  mailpit:
    image: axllent/mailpit:v1.28.2
    ports: ["127.0.0.1:${mailpit_smtp_port}:1025", "127.0.0.1:${mailpit_ui_port}:8025"]
volumes:
  postgres:
EOF

cat > "$environment_file" <<EOF
API_HOST=127.0.0.1
API_PORT=${api_port}
API_INTERNAL_ORIGIN=http://127.0.0.1:${api_port}
CSRF_SECRET=$(secret)
DATABASE_URL=postgresql://mugful:lifecycle-only-password@127.0.0.1:${postgres_port}/mugful
IDENTITY_TOKEN_PEPPER=$(secret)
INVITE_TOKEN_PEPPER=$(secret)
RATE_LIMIT_PRINCIPAL_PEPPER=$(secret)
REGISTRATION_DEFAULT_ENABLED=true
SESSION_TOKEN_PEPPER=$(secret)
SMTP_FROM='Mugful <noreply@mugful.test>'
SMTP_HOST=127.0.0.1
SMTP_PORT=${mailpit_smtp_port}
SMTP_SECURE=false
WEB_ORIGIN=http://127.0.0.1:${web_port}
EOF

cp "$root_dir/apps/web/next-env.d.ts" "$web_next_env_backup"
cp "$root_dir/apps/web/tsconfig.json" "$web_tsconfig_backup"

docker compose --project-name "$run_id" --file "$compose_file" up --detach
until docker compose --project-name "$run_id" --file "$compose_file" exec -T postgres pg_isready -h 127.0.0.1 -U mugful -d mugful >/dev/null; do sleep 1; done

set -a
source "$environment_file"
set +a
(cd "$root_dir/apps/api" && ./node_modules/.bin/drizzle-kit migrate --config drizzle.config.ts)
(cd "$root_dir" && npx --yes pnpm@11.20.0 --filter @mugful/api build)
MUGFUL_RUN_DATABASE_TESTS=true \
MUGFUL_TEST_DATABASE_URL="postgresql://mugful:lifecycle-only-password@127.0.0.1:${postgres_port}/mugful" \
MUGFUL_TEST_MAILPIT_URL="http://127.0.0.1:${mailpit_ui_port}" \
MUGFUL_TEST_SMTP_PORT="${mailpit_smtp_port}" \
MUGFUL_TEST_STOPPED_SMTP_PORT="$(unused_port)" \
npx --yes pnpm@11.20.0 --filter @mugful/api test -- \
  src/openapi.integration.test.ts \
  src/identity/http-auth.integration.test.ts \
  src/identity/http-privacy.integration.test.ts \
  src/identity/http-security.integration.test.ts \
  src/identity/http-session.integration.test.ts \
  src/identity/http-email.integration.test.ts
(cd "$root_dir/apps/web" && env -i \
  "PATH=$PATH" \
  NODE_ENV=production \
  API_INTERNAL_ORIGIN="http://127.0.0.1:${api_port}" \
  NEXT_DIST_DIR="$web_dist_dir" \
  NEXT_PUBLIC_REGISTRATION_ENABLED=true \
  ./node_modules/.bin/next build)
start_owned sh -c "cd '$root_dir/apps/api' && exec node dist/main.js >'$api_log' 2>&1"
api_pid="$owned_pid"
until curl --fail --silent "http://127.0.0.1:${api_port}/health/live" >/dev/null; do sleep 1; done
start_owned env -i "PATH=$PATH" NODE_ENV=production API_INTERNAL_ORIGIN="http://127.0.0.1:${api_port}" NEXT_DIST_DIR="$web_dist_dir" NEXT_PUBLIC_REGISTRATION_ENABLED=true sh -c "cd '$root_dir/apps/web' && exec ./node_modules/.bin/next start -p '$web_port' >'$web_log' 2>&1"
web_pid="$owned_pid"
until curl --fail --silent "http://127.0.0.1:${web_port}/login" >/dev/null; do sleep 1; done

cd "$root_dir/apps/web"
MUGFUL_TEST_MAILPIT_URL="http://127.0.0.1:${mailpit_ui_port}" \
MUGFUL_TEST_API_ORIGIN="http://127.0.0.1:${api_port}" \
PLAYWRIGHT_BASE_URL="http://127.0.0.1:${web_port}" \
PLAYWRIGHT_OUTPUT_DIR="$runtime_dir/playwright-output" \
PLAYWRIGHT_REPORT_FILE="$runtime_dir/playwright-report.json" \
./node_modules/.bin/playwright test e2e/auth-lifecycle.spec.ts e2e/auth-token-coverage.spec.ts e2e/authenticated-pages.spec.ts --workers=1
NEXT_PUBLIC_REGISTRATION_ENABLED=true \
PLAYWRIGHT_BASE_URL="http://127.0.0.1:${web_port}" \
PLAYWRIGHT_OUTPUT_DIR="$runtime_dir/public-shell-output" \
PLAYWRIGHT_REPORT_FILE="$runtime_dir/public-shell-report.json" \
./node_modules/.bin/playwright test e2e/public-shell.spec.ts --workers=1
stop_owned "$web_pid"
(cd "$root_dir/apps/web" && env -i \
  "PATH=$PATH" \
  NODE_ENV=production \
  API_INTERNAL_ORIGIN="http://127.0.0.1:${api_port}" \
  NEXT_DIST_DIR="$web_dist_dir" \
  NEXT_PUBLIC_REGISTRATION_ENABLED=false \
  ./node_modules/.bin/next build)
start_owned env -i "PATH=$PATH" NODE_ENV=production API_INTERNAL_ORIGIN="http://127.0.0.1:${api_port}" NEXT_DIST_DIR="$web_dist_dir" NEXT_PUBLIC_REGISTRATION_ENABLED=false sh -c "cd '$root_dir/apps/web' && exec ./node_modules/.bin/next start -p '$web_port' >'$web_log' 2>&1"
web_pid="$owned_pid"
until curl --fail --silent "http://127.0.0.1:${web_port}/register" >/dev/null; do sleep 1; done
MUGFUL_TEST_REGISTRATION_CLOSED=true \
PLAYWRIGHT_BASE_URL="http://127.0.0.1:${web_port}" \
PLAYWRIGHT_OUTPUT_DIR="$runtime_dir/closed-output" \
PLAYWRIGHT_REPORT_FILE="$runtime_dir/closed-report.json" \
./node_modules/.bin/playwright test e2e/auth-lifecycle.spec.ts e2e/auth-token-coverage.spec.ts --workers=1
