# Mugful

A private, playful web space for adults in long-distance relationships. The first release focuses on one shared activity: **Guess My Answer**.

> **Status:** The local runtime foundation, Todo 4 accessible public/auth UI shell, and Todo 5A-5E identity checkpoints plus the 5F identity-consent foundation are implemented. Todo 5 remains in progress pending an independent final review; product behavior remains unimplemented.

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

This repository contains local-only PostgreSQL 17 and Mailpit Compose services, Fastify liveness/readiness API, a minimal Next.js proxy, and manual identity migrations. Todo 5A-5E provide the bounded account, email verification, secure-session, reset, OpenAPI, and negative-path identity foundation. Registration records separate adult self-attestation, Terms, and Privacy Notice affirmations as three atomic, versioned consent records. The Bahasa-first registration flow has no preselected consent. Authenticated users can read their Terms/Privacy consent versions and timestamps, email-verification status, and links to account-security/session controls through `/privacy`. It intentionally does not implement privacy export, correction, deletion, withdrawal, or restriction operations. Tokens are HMAC-persisted, short-lived, replaced on resend, atomically single-use, and sent only in fragment links. Registration remains closed by default; account creation does not create a session before email verification. Todo 5 remains in progress pending independent final review; product behavior remains unimplemented.

With Node 22 and pnpm 11.20.0 installed, a contributor can verify the tooling foundation with:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
cp .env.example .env
pnpm build
```

The web shell has production-server Playwright coverage for public/auth routes and the authenticated identity lifecycle, including `/privacy`, at mobile, tablet, and desktop widths. Run the isolated API/PostgreSQL/Mailpit/browser lifecycle through `scripts/run-auth-lifecycle.sh` after the regular production build.

Create ignored `.env` from `.env.example`, replace its local-only password consistently, then run `docker compose -f compose.yaml up -d postgres mailpit`, `pnpm --filter @mugful/api dev`, and `pnpm --filter @mugful/web dev`. Mailpit is available only on `http://127.0.0.1:8025`; it captures local messages and is not a production provider. Liveness is `http://127.0.0.1:3001/health/live`; the proxy is `http://127.0.0.1:3000/api/health/live`. Run the reviewed bootstrap migration only explicitly with `pnpm --filter @mugful/api db:migrate`.

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

Apache-2.0. Contributions are welcome once the implementation begins and must preserve the product’s privacy, security, accessibility, and documentation requirements.
