# Development guide

**Status:** Pre-implementation guide. Exact commands are added only when the toolchain exists and have been verified locally.

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

Mugful is a public documentation-only repository. Product and architecture discovery is complete, but application implementation has not started. The public repository is `https://github.com/momokii/mugful`; the latest verified branch is `master` at commit `f3d599d`.

There is currently no runnable application command. The following are planned, not available yet:

- package installation or workspace scripts;
- Next.js web development server;
- Fastify API development server;
- PostgreSQL Compose services;
- Mailpit Compose service;
- tests, CI workflows, Docker builds, and deployment scripts.

Do not claim any of these commands work until they exist and have been run successfully.

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

## First implementation slice

Do not start with the game UI. Build and verify the foundation vertically:

1. Scaffold the monorepo and strict TypeScript configuration.
2. Add linting, formatting, type checking, and test commands.
3. Add development Compose services for PostgreSQL and Mailpit.
4. Add validated environment configuration and a safe `.env.example`.
5. Add minimal web/API health boundaries.
6. Add CI checks and update this guide with commands that actually work.

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
