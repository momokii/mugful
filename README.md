# Mugful

A private, playful web space for adults in long-distance relationships. The first release focuses on one shared activity: **Guess My Answer**.

> **Status:** The repository contains implemented v1 slices through deployment/operations, Guess My Answer realtime, privacy operations, and Together Room foundations. It is in active stabilization, not ready for invite-only beta: the full two-account Guess My Answer browser journey still needs final verification. The local Mugful Compose runtime and its service images are intentionally stopped and removed as of 2026-09-06.

## Product direction

Two partners create or join one private couple space. Either partner can start a curated prompt round, answer privately, and reveal both answers together after both have submitted. The experience works asynchronously and becomes more lively when both partners are online.

v1 deliberately does **not** include native video, AI, behavioral analytics, or multiple activities. Those are documented future milestones rather than unfinished promises.

## Technology direction

- Next.js + React + TypeScript web app.
- Fastify + TypeScript modular API/realtime backend.
- pnpm workspaces + Turborepo monorepo.
- PostgreSQL + Drizzle ORM.
- REST JSON + OpenAPI for commands.
- Socket.IO for presence and post-commit events.
- TanStack Query for server-state caching.
- Docker Compose for development, testing, and VPS deployment.
- Separate public Docker Hub web/API images with semantic-version and commit-SHA tags.

## Current repository state

This repository contains the Next.js web app, Fastify API/realtime service, PostgreSQL/Drizzle migrations, and Docker Compose definitions for local and production-style operation. The implemented product includes verified identity and couple onboarding, prompt administration, Guess My Answer rounds with private answer locking, history deletion, Socket.IO room updates, Privacy Center operations, and the initial Together Room foundation. The most recent Guess My Answer work adds an in-app destructive-action confirmation and corrects the reloaded partner’s pending-answer state; it has passed lint, type checking, and production build, but needs final two-account browser verification before any beta claim. Registration remains feature-flagged and closed by default. See [`docs/CURRENT-STATUS.md`](./docs/CURRENT-STATUS.md) for the authoritative release and runtime status.

## Run with Docker

All runnable paths are Docker-based. Pick one; every path starts from the same ignored env file.

```sh
cp .env.example .env
# edit .env and replace every `replace-with-a-...` secret/password
```

### 1) Verify tooling (no Docker needed)

```sh
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
pnpm build
```

### 2) Local development — DB in Docker, app on host (fastest iteration)

```sh
docker compose -f compose.yaml up -d postgres mailpit
pnpm --filter @mugful/api db:migrate   # explicit, never on startup
pnpm --filter @mugful/api dev          # http://127.0.0.1:3001/health/live
pnpm --filter @mugful/web dev          # http://127.0.0.1:3000  (proxies /api to API)
# Mailpit inbox: http://127.0.0.1:8025  — SMTP is localhost-only
docker compose -f compose.yaml down    # add -v to drop postgres-data
```

### 3) Production-style — everything in Docker (closest to VPS)

Builds the same multi-stage images that are published to Docker Hub (`momokii/mugful-web`, `momokii/mugful-api`):

```sh
docker compose -f compose.yaml -f compose.prod.yaml config  # verify WEB_ORIGIN, ports, images
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
docker compose -f compose.yaml -f compose.prod.yaml ps      # wait for healthy
curl http://127.0.0.1:3001/health/live
curl http://127.0.0.1:3002/api/health/live
docker compose -f compose.yaml -f compose.prod.yaml down            # keep data
docker compose -f compose.yaml -f compose.prod.yaml down --rmi all -v  # full reset
```

`compose.prod.yaml` pins `NODE_ENV=production`, exposes `api:3001` and `web:3002` on `0.0.0.0`, adds healthchecks, and sets `API_INTERNAL_ORIGIN=http://api:3001` inside the compose network. `WEB_ORIGIN` must exactly match the browser origin (scheme + host + port) — it selects the cookie policy (`__Host-*` Secure on https, plain on http for Tailscale/LAN).

For a real VPS behind Traefik, set `WEB_ORIGIN`, `TRAEFIK_HOST`, and `IMAGE_TAG` (pin `vX.Y.Z` or commit SHA, never `latest` in prod) and keep secrets in a restricted `.env` outside the repo. See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and [`docs/ENVIRONMENT.md`](./docs/ENVIRONMENT.md).

### 4) Private-network QA — expose Mailpit UI on Tailscale only

```sh
docker compose -f compose.yaml -f compose.prod.yaml -f compose.tailscale.yaml up -d
# Mailpit UI now on 0.0.0.0:8025 for trusted mesh only; base compose keeps it on 127.0.0.1
```

Never commit a Tailscale IP; describe it generically.

### Useful checks

```sh
pnpm --filter @mugful/api db:migrate          # reviewed bootstrap migration, explicit only
scripts/run-auth-lifecycle.sh                 # isolated Postgres + Mailpit + prod build + Playwright (375/768/1280)
docker compose -f compose.yaml -f compose.prod.yaml exec postgres pg_isready -h 127.0.0.1 -U mugful -d mugful
```

## Documentation map

- [`CLAUDE.md`](./CLAUDE.md) — session orientation and project invariants.
- [`DESIGN.md`](./DESIGN.md) — visual tokens and UI rules; required before UI code.
- [`docs/README.md`](./docs/README.md) — documentation index and reading order.
- [`docs/CURRENT-STATUS.md`](./docs/CURRENT-STATUS.md) — honest current phase, completed work, and next step.
- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) — fresh-session development handoff and verified-command policy.
- [`docs/PRODUCT-SPEC.md`](./docs/PRODUCT-SPEC.md) — agreed product and implementation specification.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — service boundaries, data flow, privacy, deployment, and operations.
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — v1 phases, stability gate, and future v1.1 work.
- [`docs/EXTERNAL-SERVICES.md`](./docs/EXTERNAL-SERVICES.md) — external-service setup checklist.
- [`docs/ENVIRONMENT.md`](./docs/ENVIRONMENT.md) — environment-variable categories and secret-handling rules.
- [`docs/decisions/README.md`](./docs/decisions/README.md) — ADR format for future architectural changes.
- [`docs/INDONESIA-PDP-COMPLIANCE-CHECKLIST.md`](./docs/INDONESIA-PDP-COMPLIANCE-CHECKLIST.md) — source-backed UU PDP research; not legal advice.
- [`docs/SMTP-OPTIONS-RESEARCH.md`](./docs/SMTP-OPTIONS-RESEARCH.md) — Mailpit, Resend, Brevo, Gmail, and SMTP setup research.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution and documentation workflow.
- [`SECURITY.md`](./SECURITY.md) — vulnerability-reporting policy and security boundaries.

## Open-source principles

The source repository is intended to be public from its first commit. Do not commit secrets, real user data, private keys, production environment files, or unredacted operational logs. Apache-2.0 applies to the project; see [`LICENSE`](./LICENSE).

## Deployment promise

The finished v1 will provide documented Docker Compose configurations and a single deployment entry point for a personal VPS. The deployment documentation will cover environment validation, Docker Hub authentication, Traefik integration points, migrations, backups, health checks, rollback, and external SMTP setup.

## Privacy boundary

The app is designed around Indonesian UU PDP principles and an application-level privacy boundary. Superadmins can manage operational metadata but cannot read private couple content through normal application interfaces. This is not the same as end-to-end encryption; E2EE is future work.

## License

Apache-2.0. Contributions are welcome and must preserve the product’s privacy, security, accessibility, and documentation requirements.
