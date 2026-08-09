# Current status

**Last updated:** 2026-08-08
**Phase:** Product and architecture discovery complete; implementation not started
**Release target:** v1 invite-only beta

## Completed

- Product direction confirmed for adult LDR romantic couples.
- v1 scope limited to Guess My Answer plus supporting account, couple, privacy, notification, and administration capabilities.
- Architecture confirmed: Next.js web, Fastify API/realtime, TypeScript monorepo, PostgreSQL/Drizzle, REST/OpenAPI, Socket.IO, Docker Compose, and no Redis in v1.
- Privacy/security boundary confirmed: operational-only superadmin, application-level encryption, Privacy Center, UU PDP research, and no analytics/AI/video in v1.
- Deployment direction confirmed: personal VPS behind Traefik, public Docker Hub images, semantic-version/SHA tags, CI quality gates, encrypted backups, and rollback support.
- UI direction confirmed and recorded in the root design system.
- Product specification, architecture, roadmap, contributor guidance, security policy, and external-service index created.
- SMTP and Indonesia UU PDP research notes created under `docs/`.

## Not started

- Monorepo scaffolding and package manager configuration.
- Next.js web application.
- Fastify API/realtime application.
- Database schema and migrations.
- Authentication, invitations, and Privacy Center.
- Prompt catalog and Guess My Answer state machine.
- Docker Compose configurations and deployment scripts.
- CI workflows and Docker Hub publication.
- Final environment-variable reference with exact implementation names; the current planning categories are documented in `docs/ENVIRONMENT.md`.

## Next recommended step

Create the implementation plan as small vertical slices, beginning with repository/toolchain scaffolding and a verified local Docker development environment. Do not add video, AI, analytics, Redis, or a second activity while building v1.

## Known constraints

- The project is pre-implementation and must not be described as production-ready.
- UU PDP research is not legal advice; counsel-needed items remain open.
- SMTP quotas and provider policies change; re-check official sources before production setup.
- The application-level privacy boundary is not end-to-end encryption.
