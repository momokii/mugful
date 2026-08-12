# Development guide

**Status:** 0b local runtime foundation, Todo 4 accessible web shell, and Todo 5A/5B1/5B2/5C identity checkpoints verified. Todo 5 remains in progress; the thin identity UI is verified, while product behavior remains unimplemented.

This document is the handoff point for a fresh agent or contributor who does not have the conversation history.

## Start every session here

Read these documents in order:

1. [`../CLAUDE.md`](../CLAUDE.md) — project invariants and session rules.
2. [`CURRENT-STATUS.md`](./CURRENT-STATUS.md) — latest verified state and next slice.
3. [`PRODUCT-SPEC.md`](./PRODUCT-SPEC.md) — user-visible v1 behavior.
4. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — service boundaries and security model.
5. [`ROADMAP.md`](./ROADMAP.md) — implementation phases and stability gate.
6. [`../DESIGN.md`](../DESIGN.md) — visual system before any UI work.
7. The relevant research or ADR documents before changing a related decision.

Then inspect the current Git state:

- confirm the branch and upstream;
- read recent commits;
- inspect the working tree before editing;
- never include `.codegraph`, `.omo`, environment files, secrets, or generated artifacts.

## Current state

Mugful has strict TypeScript tooling, local-only PostgreSQL 17 and Mailpit Compose services, Fastify health API, minimal Next.js proxy, a static Next.js public/auth shell, manual identity persistence migrations, and bounded internal identity HTTP checkpoints. Todo 5B2 exposes `/v1` CSRF issuance, registration, login, logout, current session, password change, active session listing, and owned non-current session revocation. Todo 5C adds CSRF/origin-protected verification resend/confirm and password forgot/reset commands. Registration remains closed by default and registration never creates a session until email verification.

Use Node 22 and the committed pnpm 11.20.0 pin. The following commands have been verified locally:

Before running the build, create the ignored environment file with `cp .env.example .env`. The build wrapper reads the server-only `API_INTERNAL_ORIGIN` from that file and still rejects missing or invalid configuration.

- `pnpm install --frozen-lockfile`;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm format:check`;
- `pnpm test`;
- `cp .env.example .env`;
- `pnpm build`;
- `API_INTERNAL_ORIGIN=http://127.0.0.1:3001 pnpm --filter @mugful/web e2e`, which runs the production-server Playwright checks at 375px, 768px, and 1280px and writes evidence under `.omo/evidence/task-4-*`;
- `pnpm dev`, which compiles and prints labels from the two shell entry points.

The following are planned, not available yet:

- Next.js product development server beyond the verified static shell;
- Fastify API development server;
- PostgreSQL Compose services;
- tests, CI workflows, Docker builds, and deployment scripts.

Do not describe the shell commands as application runtime commands or claim any planned service exists until it has been implemented and verified.

## Locked stack

- TypeScript end to end.
- pnpm workspaces and Turborepo.
- Next.js + React web application.
- Fastify API and Socket.IO realtime backend.
- PostgreSQL with Drizzle ORM.
- REST JSON and OpenAPI for HTTP commands.
- TanStack Query for server state.
- Docker Compose for development, testing, and VPS deployment.
- Public Docker Hub web/API images tagged with semantic versions and commit SHAs.

## Local runtime

1. Create ignored `.env` from `.env.example` and replace the local-only password in both database variables.
2. Run `docker compose -f compose.yaml up -d postgres mailpit` and `docker compose -f compose.yaml exec postgres pg_isready -h 127.0.0.1 -U mugful -d mugful`. Mailpit’s local capture UI is `http://127.0.0.1:8025`.
3. Apply the reviewed migration explicitly with `pnpm --filter @mugful/api db:migrate`.
4. Start Fastify and Next with their package `dev` commands. Verify liveness, readiness, and `http://127.0.0.1:3000/api/health/live` with curl.
5. Clean with `docker compose -f compose.yaml down -v`.

Compose health only proves PostgreSQL accepts TCP connections. Fastify liveness never queries PostgreSQL; readiness uses a read-only query and returns generic 503 on failure. Startup, development, Fastify construction, readiness, and Compose never import or run migration code.

Todo 5A migration verification also runs `MUGFUL_RUN_DATABASE_TESTS=true DATABASE_URL=<local URL> pnpm --filter @mugful/api test -- src/identity/schema.integration.test.ts` after the manual migration. The test is skipped unless explicitly enabled so ordinary unit runs do not require PostgreSQL.

Todo 5B2 HTTP verification requires a manually migrated, isolated PostgreSQL database and runs `MUGFUL_RUN_DATABASE_TESTS=true MUGFUL_TEST_DATABASE_URL=<isolated URL> pnpm --filter @mugful/api test -- src/identity/http-auth.integration.test.ts src/identity/http-session.integration.test.ts`. The suite uses Fastify injection against the real database; application startup does not execute migrations.

Todo 5C integration verification uses an isolated Compose PostgreSQL and Mailpit pair, manually applies migrations, and runs `MUGFUL_RUN_DATABASE_TESTS=true MUGFUL_TEST_DATABASE_URL=<isolated URL> MUGFUL_TEST_MAILPIT_URL=<isolated Mailpit URL> MUGFUL_TEST_SMTP_PORT=<isolated SMTP port> pnpm --filter @mugful/api test -- src/identity/http-email.integration.test.ts`. It captures SMTP delivery through Mailpit’s API, checks fragment-only links, HMAC-only database storage, single use and expiry, generic absent-address responses, and unavailable-SMTP resend recovery. It does not run migrations on startup or require a production provider.

Todo 5D browser verification is `scripts/run-auth-lifecycle.sh`. It creates a unique Compose project and brand-new PostgreSQL volume for every run, applies migrations explicitly, starts production-built API and Next processes on isolated ports, runs serial real-Chromium auth lifecycle checks with unique addresses, then removes processes, containers, volumes, temporary environment files, and Playwright evidence. It covers enabled registration, Mailpit verification and reset links, fragment-token removal, session revoke through the production proxy, logout, password change, and responsive token-page checks at 375px, 768px, and 1280px. A proxy revoke failure is reported only with a sanitized direct-versus-proxy comparison.

## First implementation slice

Do not start with the game UI. Build and verify the foundation vertically:

1. Add development Compose services for PostgreSQL and Mailpit.
2. Add validated environment configuration and a safe `.env.example`.
3. Add minimal web/API health boundaries.
4. Add CI checks and update this guide with commands that actually work.

The first slice is complete only when a fresh contributor can clone the repository, follow the README, start the local dependencies, run validation, and understand the result.

## Implementation workflow

- Work in vertical slices that produce observable behavior.
- Write a behavior test at the highest stable seam before implementation.
- Keep HTTP commands authoritative; emit Socket.IO events only after commit.
- Use PostgreSQL as the source of truth; do not introduce Redis without measured need.
- Keep private couple content out of logs, admin APIs, fixtures, screenshots, and research examples.
- Treat documentation as part of the implementation, not follow-up work. Update `CURRENT-STATUS.md` and the relevant spec, architecture/ADR, environment reference, external-service runbook, security/privacy note, test guidance, or roadmap in the same change whenever behavior, configuration, API contracts, deployment, security, or decisions change. Do this automatically; a separate user reminder is not required.
- For UI, read `DESIGN.md` first, use its tokens, and perform real-browser visual QA at mobile, tablet, and desktop sizes.

## Verification gates

Every implementation slice should run the applicable checks:

- strict type checking;
- linting and formatting;
- unit/domain behavior tests;
- API/database integration tests against PostgreSQL;
- REST/OpenAPI contract checks;
- Socket.IO authorization and post-commit event tests;
- Playwright critical-flow tests;
- Docker build and health checks;
- secret, dependency, and container scans;
- documentation and current-status update.

## Scope guardrails

Do not add native video, AI, behavioral analytics, Redis, E2EE, user-generated prompts, multiple activities, or public registration as the initial default during v1 implementation. Native video is v1.1 work after the documented stability gate.

## Git and release workflow

- Keep commits small and focused by concern.
- Never commit or push without explicit authorization.
- CI should validate every change; Docker Hub publication should happen for release tags, not arbitrary local work.
- Production deployment must pin a semantic version or commit-SHA image tag, never `latest`.
- Never force-push `master`.
