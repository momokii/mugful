# Current status

**Last updated:** 2026-08-09
**Phase:** 0b local runtime and database health boundary complete
**Release target:** v1 invite-only beta
**Product name:** Mugful
**Public repository:** https://github.com/momokii/mugful
**Latest verified baseline:** `b4563f76ef6affe9a62bebe4df5a517e445acc89` on `master` before the authorized tooling commit

## Completed

- Product direction confirmed for adult LDR romantic couples.
- v1 scope limited to Guess My Answer plus supporting account, couple, privacy, notification, and administration capabilities.
- Architecture confirmed: Next.js web, Fastify API/realtime, TypeScript monorepo, PostgreSQL/Drizzle, REST/OpenAPI, Socket.IO, Docker Compose, and no Redis in v1.
- Privacy/security boundary confirmed: operational-only superadmin, application-level encryption, Privacy Center, UU PDP research, and no analytics/AI/video in v1.
- Deployment direction confirmed: personal VPS behind Traefik, public Docker Hub images, semantic-version/SHA tags, CI quality gates, encrypted backups, and rollback support.
- UI direction confirmed and recorded in the root design system.
- Product specification, architecture, roadmap, contributor guidance, security policy, and external-service index created.
- SMTP and Indonesia UU PDP research notes created under `docs/`.
- Naming research completed; Mugful is the selected working name pending final trademark, domain, app-store, and namespace verification.
- Documentation baseline committed as nine atomic commits and pushed to the public GitHub repository.
- Private pnpm workspace configured for `apps/*` and `packages/*`, pinned to Node 22 and pnpm 11.20.0.
- Turborepo tasks, strict TypeScript, ESLint, Prettier, Vitest, frozen-lockfile installation, and root validation scripts verified locally.
- `apps/web` and `apps/api` contain only TypeScript executable smoke shells with a `workspace:*` dependency on shared contracts; they provide no framework, HTTP, realtime, or product behavior.
- Local-only PostgreSQL 17 Compose, Fastify liveness/readiness, Drizzle/node-postgres, one manual neutral migration, validated environment, and minimal Next proxy are implemented and verified.

## Not started

- Next.js web application.
- Fastify API/realtime application.
- Database schema and migrations.
- Authentication, invitations, and Privacy Center.
- Prompt catalog and Guess My Answer state machine.
- Docker Compose configurations and deployment scripts.
- CI workflows and Docker Hub publication.
- Final environment-variable reference with exact implementation names; the current planning categories are documented in `docs/ENVIRONMENT.md`.

## Next recommended step

Build Todo 4 or 5 from the foundation plan. Do not add video, AI, analytics, Redis, or a second activity while building v1.

## Command status

`pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm build` are verified. Local runtime verification additionally requires the documented Compose, manual migration, API, and Next proxy checks.

## Known constraints

- The project has tooling only and must not be described as production-ready or as having a running application.
- UU PDP research is not legal advice; counsel-needed items remain open.
- SMTP quotas and provider policies change; re-check official sources before production setup.
- The application-level privacy boundary is not end-to-end encryption.
