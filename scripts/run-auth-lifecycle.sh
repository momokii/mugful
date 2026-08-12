#!/usr/bin/env bash
set -euo pipefail

run_id="auth-lifecycle-$(date +%s)-$$"
root_dir="$(GIT_MASTER=1 git rev-parse --show-toplevel)"
runtime_dir="$(mktemp -d)"
compose_file="$runtime_dir/compose.yaml"
environment_file="$runtime_dir/runtime.env"
api_log="$runtime_dir/api.log"
web_log="$runtime_dir/web.log"
unused_port() { node -e 'require("node:net").createServer().listen(0,"127.0.0.1", function () { console.log(this.address().port); this.close(); })'; }
secret() { node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'; }
postgres_port="$(unused_port)"
mailpit_smtp_port="$(unused_port)"
mailpit_ui_port="$(unused_port)"
api_port="$(unused_port)"
web_port="$(unused_port)"

cleanup() {
  status=$?
  if [[ -n "${web_pid:-}" ]]; then kill "$web_pid" 2>/dev/null || true; fi
  if [[ -n "${api_pid:-}" ]]; then kill "$api_pid" 2>/dev/null || true; fi
  docker compose --project-name "$run_id" --file "$compose_file" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$runtime_dir"
  exit "$status"
}
trap cleanup EXIT INT TERM

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
RATE_LIMIT_PRINCIPAL_PEPPER=$(secret)
REGISTRATION_DEFAULT_ENABLED=true
SESSION_TOKEN_PEPPER=$(secret)
SMTP_FROM='Mugful <noreply@mugful.test>'
SMTP_HOST=127.0.0.1
SMTP_PORT=${mailpit_smtp_port}
SMTP_SECURE=false
WEB_ORIGIN=http://127.0.0.1:${web_port}
EOF

docker compose --project-name "$run_id" --file "$compose_file" up --detach
until docker compose --project-name "$run_id" --file "$compose_file" exec -T postgres pg_isready -h 127.0.0.1 -U mugful -d mugful >/dev/null; do sleep 1; done

set -a
source "$environment_file"
set +a
(cd "$root_dir/apps/api" && ./node_modules/.bin/drizzle-kit migrate --config drizzle.config.ts)
(cd "$root_dir/apps/web" && API_INTERNAL_ORIGIN="http://127.0.0.1:${api_port}" ./node_modules/.bin/next build)
(cd "$root_dir/apps/api" && node dist/main.js >"$api_log" 2>&1) & api_pid=$!
until curl --fail --silent "http://127.0.0.1:${api_port}/health/live" >/dev/null; do sleep 1; done
(cd "$root_dir/apps/web" && ./node_modules/.bin/next start -p "$web_port" >"$web_log" 2>&1) & web_pid=$!
until curl --fail --silent "http://127.0.0.1:${web_port}/login" >/dev/null; do sleep 1; done

cd "$root_dir/apps/web"
MUGFUL_TEST_MAILPIT_URL="http://127.0.0.1:${mailpit_ui_port}" \
MUGFUL_TEST_API_ORIGIN="http://127.0.0.1:${api_port}" \
PLAYWRIGHT_BASE_URL="http://127.0.0.1:${web_port}" \
PLAYWRIGHT_OUTPUT_DIR="$runtime_dir/playwright-output" \
PLAYWRIGHT_REPORT_FILE="$runtime_dir/playwright-report.json" \
./node_modules/.bin/playwright test e2e/auth-lifecycle.spec.ts --workers=1
