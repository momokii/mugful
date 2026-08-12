# Current status

**Last updated:** 2026-08-13
**Phase:** 0b local runtime/database health boundary and Todo 4 accessible web shell complete; Todo 5 identity work in progress
**Release target:** v1 invite-only beta
**Product name:** Mugful
**Public repository:** https://github.com/momokii/mugful
**Latest verified baseline:** `21187a5` on `master` before Todo 5D implementation

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
- Accessible static public/auth shell is implemented at `/`, `/login`, and `/register` with documented Mugful tokens, CSS Modules, semantic landmarks, dark color-scheme support, reduced-motion support, visible focus, and responsive no-overflow behavior.
- Production-server Playwright browser checks and screenshots are verified at 375px, 768px, and 1280px for the public/auth shell; evidence is stored under `.omo/evidence/task-4-*`.
- Todo 5A identity persistence primitives are implemented and verified: `0001_identity.sql` adds accounts, versioned adult/terms/privacy consent records, hashed opaque sessions, and hashed single-use expiring identity tokens without raw credential or token columns.
- Internal Argon2id password hash/verify policy, opaque token HMAC/expiry/single-use guards, session token/cookie-option types, and versioned consent vocabulary have focused unit coverage. The manual migration was applied and schema-checked against local PostgreSQL Compose.
- Todo 5B1 identity policy persistence/configuration is verified: additive `0002_identity_policy.sql` adds normalized-email uniqueness, disabled-by-default registration policy/audit state, session lifecycle metadata, and HMAC-keyed rate-limit buckets without raw email or IP columns; `0003_rate_limit_hash_constraint.sql` enforces lowercase 64-character SHA-256 hex storage.
- Todo 5B2 identity HTTP checkpoint is verified against an isolated Compose PostgreSQL database through Fastify injection: `/v1` CSRF issuance, default-closed/config-gated atomic registration with adult/terms/privacy consent, verified-account login, logout, current session, password change session rotation, session listing, and owned non-current session revocation. Unsafe routes require same-origin plus signed/bound CSRF; authentication throttling persists only HMAC-principal keys; raw passwords and session tokens are neither logged nor stored. Registration creates no session before future email verification.
- Todo 5C email checkpoint is verified against isolated Compose PostgreSQL and Mailpit services: provider-neutral Nodemailer SMTP configuration, local-only loopback Mailpit, registration verification email, verification resend/confirm, and password forgot/reset HTTP commands. Messages contain only fragment token links. Token persistence is HMAC-only; replacement, expiry, atomic single use, absent-email generic output, SMTP failure recovery, session revocation after reset, and no token in API responses are covered through Fastify injection and Mailpit capture.
- Todo 5D thin identity UI is implemented and browser-verified against a fresh isolated PostgreSQL/Mailpit lifecycle: CSRF-protected registration, verification resend/confirm, login/logout, forgot/reset, password change, active-session revoke, fragment-only token handling, and responsive accessible light/dark shell behavior. Todo 5 remains in progress because invitations, privacy, and product behavior are not implemented.
- Todo 5E identity contract/security checkpoint is verified: Fastify generates a JSON-only `/openapi.json` document for every implemented identity endpoint and status response, with no Swagger UI route or secret/token/password examples. Isolated PostgreSQL/Mailpit Fastify-injection tests cover default-closed registration, generic enumeration-resistant responses, unverified login denial, signed CSRF binding and Origin checks, verification/reset replay and expiry, session rotation/revocation and cross-account restrictions, HMAC-principal limiting with `Retry-After`, SMTP generic failure/recovery, and secret-free API/OpenAPI outputs. Todo 5 remains in progress pending final checkpoint 5F.

## Not started

- Next.js web application beyond the Todo 4 static shell.
- Fastify API/realtime application.
- Invitations and Privacy Center.
- Identity persistence transaction orchestration for future account-and-consent creation.
- Prompt catalog and Guess My Answer state machine.
- Docker Compose configurations and deployment scripts.
- CI workflows and Docker Hub publication.
- Final environment-variable reference with exact implementation names; the current planning categories are documented in `docs/ENVIRONMENT.md`.

## Next recommended step

Continue Todo 5 with the API checkpoint only after preserving Todo 5A's hashed-secret and explicit-manual-migration boundaries. Do not add video, AI, analytics, Redis, or a second activity while building v1.

## Command status

`pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm build` are verified. Local runtime verification additionally requires the documented Compose, manual migration, API, and Next proxy checks.

## Known constraints

- The project has tooling only and must not be described as production-ready or as having a running application.
- UU PDP research is not legal advice; counsel-needed items remain open.
- SMTP quotas and provider policies change; re-check official sources before production setup.
- The application-level privacy boundary is not end-to-end encryption.
