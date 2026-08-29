# Development guide

**Status:** 0b local runtime foundation, Todo 4 accessible web shell, Todo 5 identity foundation, and Todo 6 couple onboarding are implemented and accepted. Local development also supports an explicit fail-closed email-verification bypass. Todo 7 prompt administration (7A–7C, including the `/superadmin` tooling console) is implemented and verified; Todo 8 Guess My Answer activity is next.

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

Mugful has strict TypeScript tooling, local-only PostgreSQL 17 and Mailpit Compose services, Fastify health API, minimal Next.js proxy, a static Next.js public/auth shell, manual identity persistence migrations, and bounded internal identity HTTP checkpoints. Todo 5B2 exposes `/v1` CSRF issuance, registration, login, logout, current session, password change, active session listing, and owned non-current session revocation. Todo 5C adds CSRF/origin-protected verification resend/confirm and password forgot/reset commands. Todo 5E publishes these implemented identity contracts at `/openapi.json`; no Swagger UI is served. The implemented 5F foundation uses Zod 4 at API/web boundaries, requires separate affirmative adult/Terms/Privacy values during registration, and exposes a read-only authenticated `/v1/auth/privacy` summary for the `/privacy` page. It shows accepted Terms/Privacy versions and timestamps plus email verification and account-security links. Export, correction, deletion, withdrawal, and restriction operations remain deferred. Registration remains closed by default and registration never creates a session until email verification.

Use Node 22 and the committed pnpm 11.20.0 pin. The following commands have been verified locally:

Before running the build, create the ignored environment file with `cp .env.example .env`. The build wrapper reads the server-only `API_INTERNAL_ORIGIN` from that file and still rejects missing or invalid configuration.

- `pnpm install --frozen-lockfile`;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm format:check`;
- `pnpm test`;
- `cp .env.example .env`;
- `pnpm build`;
- `scripts/run-auth-lifecycle.sh`, which creates an isolated PostgreSQL/Mailpit lifecycle and runs API/OpenAPI plus real-Chromium enabled/default-closed flows, including the authenticated Privacy Center, at 375px, 768px, and 1280px;
- `pnpm dev`, which compiles and prints labels from the two shell entry points.

The following remain planned, not available yet:

- Guess My Answer product behavior beyond the verified identity shell;
- CI workflows, Docker builds, and deployment scripts.

Do not describe planned product or deployment work as implemented.

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

### Running web/API directly (no Docker) and exposing over Tailscale

The API and web dev servers can also run as plain `pnpm` processes on the host instead of inside Docker (only PostgreSQL and Mailpit need Compose). This is useful for quick manual QA but is not the verified production path.

- Both Fastify and Next bind to `127.0.0.1` by default, so by default they are not reachable from other devices, including over a private mesh network (e.g. Tailscale).
- To make the web app reachable from another device on your private network, start it with an explicit host bind, for example `next dev --hostname 0.0.0.0` (or the equivalent `start -H 0.0.0.0` flag for a production-built server). The API can stay bound to loopback since the web app proxies `/api/*` server-side.
- Registration visibility on `/register` is controlled by two **independent** flags that must both be enabled to actually register a user during manual QA: the API's `REGISTRATION_DEFAULT_ENABLED` (gates the `/v1/auth/register` endpoint) and the web app's `NEXT_PUBLIC_REGISTRATION_ENABLED` (gates whether the web page renders the registration form at all instead of an invite-only notice). The `registration_policies` database table exists but is not currently wired into this check.
- For local account creation without an SMTP/email-confirmation round trip, also set `NODE_ENV=development` and `LOCAL_AUTH_BYPASS_EMAIL_VERIFICATION=true`. This marks the account verified inside the registration transaction and skips verification-mail issuance; it does not weaken the adult, Terms, Privacy, CSRF, password, or rate-limit checks. The API rejects this bypass when `NODE_ENV=production`.
- A safe local manual-QA combination is `REGISTRATION_DEFAULT_ENABLED=true`, `NEXT_PUBLIC_REGISTRATION_ENABLED=true`, and `LOCAL_AUTH_BYPASS_EMAIL_VERIFICATION=true`. You can then create an account and sign in immediately without configuring an external SMTP account; keep SMTP/Mailpit for testing the normal verification and password-recovery flows.
- Never commit, log, or paste your private Tailscale (or any other private-network) IP address into this repository, its documentation, commit messages, or issues — it identifies a device on your private network. If you need to reference "the private-network address," describe it generically (e.g. "your Tailscale IP") and let the reader substitute their own.
- If you don't already know the current private-network address or exposure setup for a given session, ask the user rather than assuming or reusing one from an earlier session.
- Tear down manually started processes explicitly (`kill` the PID or `pnpm` process); nothing here is cleaned up automatically like the isolated lifecycle script.

Todo 5A migration verification also runs `MUGFUL_RUN_DATABASE_TESTS=true DATABASE_URL=<local URL> pnpm --filter @mugful/api test -- src/identity/schema.integration.test.ts` after the manual migration. The test is skipped unless explicitly enabled so ordinary unit runs do not require PostgreSQL.

Todo 5B2 HTTP verification requires a manually migrated, isolated PostgreSQL database and runs `MUGFUL_RUN_DATABASE_TESTS=true MUGFUL_TEST_DATABASE_URL=<isolated URL> pnpm --filter @mugful/api test -- src/identity/http-auth.integration.test.ts src/identity/http-session.integration.test.ts`. The suite uses Fastify injection against the real database; application startup does not execute migrations.

Todo 5E/5F integration verification uses a unique isolated Compose PostgreSQL and Mailpit pair, manually applies migrations, and runs `MUGFUL_RUN_DATABASE_TESTS=true MUGFUL_TEST_DATABASE_URL=<isolated URL> MUGFUL_TEST_MAILPIT_URL=<isolated Mailpit URL> MUGFUL_TEST_SMTP_PORT=<isolated SMTP port> pnpm --filter @mugful/api test -- src/openapi.integration.test.ts src/identity/http-auth.integration.test.ts src/identity/http-privacy.integration.test.ts src/identity/http-security.integration.test.ts src/identity/http-session.integration.test.ts src/identity/http-email.integration.test.ts`. It verifies the JSON-only OpenAPI route/status matrix, authenticated privacy-summary ownership, and identity negative paths: default-closed registration, separately rejected Terms/Privacy affirmations, generic duplicates/unknown credentials and absent recovery, unverified login denial, origin and signed-CSRF binding, reset/verification replay and expiry, session rotation/revocation and ownership restrictions, HMAC-keyed rate limits with `Retry-After`, Mailpit SMTP failure/recovery, and secret-free API/OpenAPI errors. It does not run migrations on startup or require a production provider.

Todo 5D/5F browser verification is `scripts/run-auth-lifecycle.sh`. It creates a unique Compose project and brand-new PostgreSQL volume for every run, applies migrations explicitly, starts production-built API and Next process groups on isolated ports, runs serial real-Chromium auth lifecycle checks with unique addresses, then terminates and reaps only those owned process groups before removing containers, volumes, temporary environment files, and Playwright evidence. It prints a retained cleanup receipt (override with `MUGFUL_LIFECYCLE_RECEIPT_PATH`) proving `remaining_processes=none`. It covers enabled and default-closed registration, separate unchecked Bahasa adult/Terms/Privacy consent controls, accessible show/hide password controls with helper descriptions, matching confirmation-password validation with confirmation-field focus and no mutation on mismatch, correction recovery, inline `aria-invalid`/`aria-describedby` feedback, unchanged single-password API payloads, neutral verification-link success guidance, generic duplicate-email responses, Mailpit verification and reset links, fragment-token removal, the authenticated read-only Privacy Center, distinct direct and production-proxy session revocations, logout, password change, and light/dark focus/reduced-motion/no-overflow matrices at 375px, 768px, and 1280px for verification, reset, Privacy Center, and authorized security pages. Token pages also assert `no-referrer` and `no-store`; a proxy revoke assertion records only header names and no credential values.

Todo 6 API verification uses an isolated PostgreSQL Compose project, explicitly applies migrations through `0004_couple_onboarding.sql`, then runs `MUGFUL_RUN_DATABASE_TESTS=true MUGFUL_TEST_DATABASE_URL=<isolated URL> pnpm --filter @mugful/api test -- src/couples/http.integration.test.ts`. It covers verified-session create, fragment-only invite issuance, single-use acceptance, replay rejection, immediate membership revocation on end, and a 30-day deletion grace timestamp. The `/join` response also receives `no-store` and `no-referrer` headers. Browser verification runs `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/snap/bin/brave pnpm --filter @mugful/web exec playwright test e2e/couple-onboarding.spec.ts`; the focused Brave Chromium matrix covers `/onboarding` and `/join` at mobile, tablet, and desktop sizes, no load-time mutation, no horizontal overflow, and fragment removal before invite acceptance.

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
