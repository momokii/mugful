# Stack foundation research (v1)

**Status:** research note — informs a future ADR; not itself an ADR yet
**Date:** 2026-08-09
**Verified against:** primary sources (official docs, official repos, official Docker Hub images) on 2026-08-09
**Scope:** primary-source check of the confirmed v1 stack listed in `README.md` and `docs/ARCHITECTURE.md`, plus the few extra pieces (`react`, runtime validation library, OpenAPI tooling) that any concrete package setup will have to pick. Recommends a minimal foundation that stays clear of Redis, microservices, AI, analytics, and video in v1.

## Scope and ground rules

- Every claim that names a version, a port, a path, or a behavior is cited inline to the official doc, repo, or Docker Hub page where it was read.
- Third-party blog posts were not used; if a third-party tutorial is mentioned it is flagged as a secondary source.
- "Latest" and version numbers carry the date they were observed (2026-08-09) so a future reader can judge staleness.
- No secrets, env values, or provider credentials are proposed.
- Items the user explicitly listed as out-of-scope for v1 (Redis, microservices, AI, analytics, video, E2EE) appear only in the "deferred" section.
- The note does not write code or commit anything; it recommends version pins and bootstrap steps as phrases.

## Cross-cutting version pinning strategy

- Pin every dependency to a specific major (`^X.Y` or exact) and let Renovate or Dependabot open the next-minor PR; avoid loose semver ranges (`*`, `latest`) in committed manifests.
- Pin the **runtime** to the LTS major recommended by the framework (Node 22 LTS, per pnpm compatibility table) and mirror it in the base image (`node:22-bookworm-slim` for web/API; never `node:latest`).
- Pin the **database** to a PostgreSQL major that the user can live with for the whole v1 stability window. PostgreSQL 18 is the current `latest` on Docker Hub, but each major requires `pg_upgrade` or dump/restore to move up. The compatibility table below shows three viable pins, all supported by the Docker Library today.
- Pin the **OS** in every multi-stage build to a Debian major (`bookworm`) so `apt-get install` packages remain reproducible.
- Pin **Docker Hub tags** to `vX.Y.Z` _and_ a commit SHA for the image manifest; never pin to `latest` in the production compose file.
- Pin **GitHub Actions** to the major (`@v7`, `@v6`, `@v4`) per the official action readmes; renovate/dependabot handles minor bumps.
- Pin **runtime validation** to a single chosen library and use one of the official Fastify type providers; do not mix Zod + Valibot in the same request pipeline.
- Use the `packageManager` field (Corepack) to pin pnpm itself.

## Items explicitly deferred past v1 bootstrap

The user explicitly named the following as not-in-v1. Confirming they do not enter the bootstrap:

- **Redis / any in-memory cache** — ARCHITECTURE.md §"Future evolution" defers this until a measured multi-instance requirement exists. The bootstrap must not add a `redis` service to compose.
- **Microservices / service mesh / Kubernetes** — same section. Compose on a single VPS only.
- **AI / OpenAI / Anthropic / Gemini** — listed in `EXTERNAL-SERVICES.md` as "Future only". No SDK, no key, no seam installed at bootstrap.
- **Behavioral analytics** — `ARCHITECTURE.md` §"Observability" forbids logging analytics events. No analytics SDK.
- **Native WebRTC video** — `ARCHITECTURE.md` "Future evolution" places this in v1.1 only. coturn is not a dependency.
- **True E2EE** — deferred; v1 keeps application-level encryption only. No key-exchange libraries, no WebCrypto-based protocol code at bootstrap.
- **Turborepo Remote Cache (Vercel-hosted)** — Turborepo works fine with only the local cache; the Vercel-hosted remote cache is opt-in and is not needed for a single-developer or small-team v1. Do not bake it into the bootstrap.

---

## pnpm workspaces

- **Current stable major:** pnpm **11** (pnpm 12 is published as a beta and is explicitly not recommended for production by the official docs).
  Verified on 2026-08-09 at <https://pnpm.io/installation>.
- **Bootstrap recommendation:** install pnpm 11 via Corepack and pin with the `packageManager` field in the root `package.json` (e.g. `"packageManager": "pnpm@11.x.y"`). The official Corepack note warns to update Corepack itself first (`npm i -g corepack@latest`) because of outdated signatures.
- **Node engine requirement:** pnpm 11 requires Node.js 22+ for installation. The compatibility table (<https://pnpm.io/installation#compatibility>) shows pnpm 11 and 12 both work on Node 22, 24, and 26; pnpm 11 does _not_ support Node 18 or 20. The bootstrap should target Node 22 LTS.
- **Workspace protocol gotcha:** pnpm's `workspace:` spec in `package.json` is the safe way to depend on a sibling package and refuses to resolve to a non-workspace package. Prefer `"foo": "workspace:*"` over bare version specifiers so a new internal package cannot accidentally resolve to a same-name registry package.
- **Version-compat traps:**
  - pnpm 12 cannot be installed via Corepack yet (the official doc says Corepack expects `bin/pnpm.mjs` which the native pnpm 12 package does not have). If anyone tries to upgrade to pnpm 12 before the Corepack story lands, installation will silently produce a non-working binary.
  - On Linux glibc images, pnpm 11 needs `libatomic.so.1` (Debian/Ubuntu: `apt-get install -y libatomic1`). This must be added to the API/web Dockerfile or the install step will fail in slim images.
  - On Intel macOS, the pnpm 11 standalone script does not run; install via `npm`, Corepack, or Homebrew instead. (pnpm 12 fixes this.) Cite: <https://pnpm.io/installation#on-posix-systems>.
- **Defer until package setup:** choosing between `linkWorkspacePackages: true` + auto-linking vs explicit `workspace:` spec — recommend `workspace:*` everywhere and leave `linkWorkspacePackages` at its default (`false`) for clarity; the official docs note this is the safer combination.
- **Primary sources:**
  - pnpm Installation: <https://pnpm.io/installation>
  - pnpm Workspaces: <https://pnpm.io/workspaces>
  - Corepack signatures note: <https://pnpm.io/installation#using-corepack>

## Turborepo

- **Current stable major:** Turborepo is published by Vercel; the official docs site <https://turborepo.com/docs> is live and the package works with any of `npm` / `yarn` / `pnpm` and the `package.json` scripts the monorepo already has.
- **Bootstrap recommendation:** add a single `turbo.json` at the monorepo root declaring `build`, `dev`, `lint`, `test`, `typecheck` pipelines with `dependsOn` and `outputs`. Keep the local-only cache; do not opt into the Vercel-hosted remote cache at bootstrap.
- **pnpm integration:** Turborepo reads `pnpm-workspace.yaml` automatically when present. No special adapter is required.
- **Version-compat traps:**
  - Turborepo does not replace a package manager; it is a task runner on top. Do not assume it transitively installs or updates dependencies.
  - Remote cache tokens (if ever added later) are secrets and must come from a secret store, not the repo.
- **Defer until package setup:** task graph topology beyond the basics; the first cut should be flat and pipeline-only.
- **Primary sources:** <https://turborepo.com/docs>

## Next.js

- **Current stable major:** **Next.js 16.3.0** at the time of writing (the docs landing page banner reads "Latest Version 16.3.0" on 2026-08-09).
  Verified at <https://nextjs.org/docs>.
- **App Router status:** the official docs default to the App Router (`/app`). The Pages Router still exists but is documented as the legacy path. Bootstrap with the App Router.
- **Bootstrap recommendation:** `pnpm create next-app@latest` for the web package, accept TypeScript, accept App Router, accept ESLint, accept `src/` directory, **decline Tailwind** if the design system in `DESIGN.md` is the single source of truth (Tailwind in the same codebase as a separate design token system is a known drift source). The exact choice is for the planning step, not this note.
- **Standalone output for Docker:** Next.js supports `output: 'standalone'` in `next.config.js`, which produces a minimal `server.js` for production containers. This is the recommended way to build the web Docker image. (Cross-reference with the general `output` config docs at <https://nextjs.org/docs/app/api-reference/config/next-config-js/output>; the standalone option is the established production pattern.)
- **Version-compat traps:**
  - Next.js 15 → 16 was a meaningful release; if a tutorial from before that line is followed it may use removed APIs. The official "Upgrading" guide at <https://nextjs.org/docs/app/guides/upgrading/version-16> is the authoritative source.
  - React Compiler is opt-in via `next.config.js`; do not enable it on day one because the v1 stack's design system is not yet shaped against it.
- **Defer until package setup:** Turbopack-only builds, partial prefetching, and `cacheComponents` (a 16.x feature). Use the default webpack path for the first slice and switch to Turbopack once a baseline is green.
- **Primary sources:**
  - <https://nextjs.org/docs>
  - <https://nextjs.org/docs/app/getting-started/deploying>
  - <https://nextjs.org/docs/app/api-reference/config/next-config-js/output>
  - <https://nextjs.org/docs/app/guides/upgrading/version-16>

## React

- **Current stable major:** React 19 is the current line bundled with Next.js 16. Pin via the version that Next.js 16 installs; do not hand-pick a React major.
- **Bootstrap recommendation:** let Next.js's `create-next-app` decide the React major. Avoid mixing React versions between the web package and any future React Native package.
- **Defer until package setup:** React Compiler, server actions in app-router edges, experimental `use()` — all opt-in features.
- **Primary sources:** Next.js docs link to React docs from `nextjs.org/docs`.

## Fastify

- **Current stable major:** **Fastify v5.11.x** (the official docs site defaults to "latest (v5.11.x)"; LTS line is v4.29.x).
  Verified at <https://fastify.dev/docs/latest/> on 2026-08-09.
- **TypeScript story:** official first-class support. The `FastifyInstance`, `withTypeProvider`, and per-route generics are all designed for TS. The official "Type-Providers" reference page at <https://fastify.dev/docs/latest/Reference/Type-Providers/> shows the three supported providers: Zod, TypeBox, and `json-schema-to-ts`.
- **Bootstrap recommendation:** pin `fastify@^5`, write a thin plugin per module (auth, couple, activity, etc.), and use one of the official type providers to type the request/response shapes.
- **Version-compat traps:**
  - The Fastify v4 → v5 line moved `request.user` and other surface; any pre-v5 tutorial or `fastify-jwt` v6 plugin will be wrong.
  - The v3 line is documented but should be considered end-of-life for new projects.
- **Defer until package setup:** HTTP/2, custom decorators that need encapsulation context, and `@fastify/multipart` (image uploads are not a v1 feature).
- **Primary sources:**
  - <https://fastify.dev/docs/latest/>
  - <https://fastify.dev/docs/latest/Reference/Type-Providers/>

## Runtime validation + Fastify type provider (the critical coupling)

The Fastify reference page explicitly lists three inference paths. The choice has to be made before package setup, because the openapi generation story changes with it.

- **Zod 4 (current stable) + `fastify-type-provider-zod` v7+**
  - Zod 4 is stable per the official site (<https://zod.dev/>; the "Zod 4 is now stable!" banner is the very first line of the page).
  - The official Fastify docs use Zod 4 in their type-provider example and import from `zod/v4`. Verified at <https://fastify.dev/docs/latest/Reference/Type-Providers/#zod>.
  - The community `fastify-type-provider-zod` README (<https://github.com/turkerdev/fastify-type-provider-zod>) is the most actively used Zod↔Fastify bridge and ships a `jsonSchemaTransform` for `@fastify/swagger`. It also supports per-route OpenAPI targets (`openapi-3.0` vs `draft-2020-12`).
  - **Trap (verified 2026-08-09):** `fastify-type-provider-zod` v7+ switched to Zod 4.2's `.encode()`/`.decode()` APIs, so response serialization is now based on `z.output<T>` instead of `z.input<T>`. Schemas that rely on coercion (e.g. `z.coerce.number()`) will produce a different wire shape than the request input. This is a meaningful behavior change from the pre-v7 line.
  - Zod ↔ Zod-mini is also an option for size-constrained workers; the official site ships both.
- **Valibot 1.x (current stable) + `fastify-type-provider-valibot`**
  - Valibot's docs site lists a comprehensive v0.31+ → 1.0 migration and a migration from Zod/TypeBox; the API is deliberately modular.
  - Caveat: a _first-party_ Fastify type provider for Valibot is not listed on the official Fastify reference page. Adopters typically use the community `@fastify/type-provider-valibot` (or wire their own) and `valibot-to-json-schema` for OpenAPI. This is a heavier integration path than the Zod option.
- **TypeBox 1.x (current "Latest" line) + `@fastify/type-provider-typebox`**
  - The official TypeBox repo <https://github.com/sinclairzx81/typebox> describes a "Latest" 1.x line (TypeScript 6.0–7.0+, ESM-only) and an "LTS" 0.x line (TypeScript 5.0–6.0, ESM+CJS). For a brand-new project in 2026 the 1.x line is the choice.
  - `@fastify/type-provider-typebox` is the official wrapper listed on the Fastify reference page.
  - JSON Schema is TypeBox's native output, so `@fastify/swagger` integration is the most natural of the three.
- **Plain `json-schema-to-ts` + `@fastify/type-provider-json-schema-to-ts`**
  - Use this only if the team prefers hand-writing JSON Schema and inferring types from it. More work, fewer compile-time helpers.

**Recommendation for bootstrap (not a final decision — leave to planning):** Zod 4 + `fastify-type-provider-zod` v7+, because the official Fastify docs now lead with this combination and the OpenAPI transform ships in the same package. Pin a Zod major (`^4.2`) so the v7+ behavior change is locked in.

- **Primary sources:**
  - <https://zod.dev/>
  - <https://valibot.dev/>
  - <https://github.com/sinclairzx81/typebox>
  - <https://fastify.dev/docs/latest/Reference/Type-Providers/>
  - <https://github.com/turkerdev/fastify-type-provider-zod>

## OpenAPI tooling for Fastify

- **Official packages:** `@fastify/swagger` (the OpenAPI document) and `@fastify/swagger-ui` (a default UI). Both are on the official Fastify GitHub org.
- **Why this fits the chosen validator:** every type provider listed above (Zod, TypeBox, `json-schema-to-ts`) has a JSON-Schema transform that `@fastify/swagger` consumes. With the Zod provider, the `jsonSchemaTransform` exported by `fastify-type-provider-zod` produces a usable OpenAPI 3.0 or 3.1 document without hand-written duplicates.
- **Bootstrap recommendation:** register `@fastify/swagger` with `openapi: { info: { … } }`, pass the provider's transform, and register `@fastify/swagger-ui` under a non-public path (e.g. `/docs` behind basic auth in production, public in local).
- **Version-compat trap:** the `openapi: { openapi: '3.0.x' }` field on the swagger plugin flips the JSON Schema target. Picking the wrong target with the Zod provider leads to subtle "format" and `null` type differences. Choose the target explicitly.
- **Primary sources:**
  - <https://github.com/fastify/fastify-swagger>
  - <https://github.com/turkerdev/fastify-type-provider-zod#how-to-use-together-with-fastifyswagger>

## Socket.IO

- **Current stable major:** **Socket.IO 4.x** on both server and client. The official docs site still has a 3.x branch but the docs banner defaults to "4.x".
  Verified at <https://socket.io/docs/v4/> on 2026-08-09; the site footer reads "Copyright © 2026 Socket.IO".
- **Server package:** `socket.io@4` (Node). The `socket.io-deno` and other-language packages are listed but the Node package is the canonical one.
- **Client package:** `socket.io-client@4`. Pin the same major as the server; a v3 client cannot talk to a v4 server and vice versa.
- **Integration with Fastify:** Socket.IO mounts an HTTP server; the standard pattern is `const io = new Server(fastify.server, { … })` so it reuses Fastify's underlying HTTP listener. There is no longer a "fastify-socket.io" plugin in the official ecosystem; the community plugin `fastify-socket.io` (latest major tracked on npm) is the path of least resistance if a plugin wrapper is desired.
- **Bootstrap recommendation:** pin both packages to the same `4.x` major, mount on the Fastify HTTP server, and use the default path `/socket.io`. Do not turn on WebTransport in v1 (still being stabilized in browsers; cross-reference the "What Socket.IO is" page at <https://socket.io/docs/v4/>).
- **Version-compat traps:**
  - v3 ↔ v4 client/server mismatch is silent at build time and loud at runtime. Pin both ends.
  - Socket.IO is **not** a WebSocket server. Do not point a plain `ws` client at it; the doc calls this out explicitly.
  - Connection state recovery and packet buffering are v4 features; rely on them rather than reinventing.
- **Defer until package setup:** the Redis adapter for horizontal scaling (only needed if/when the API runs on more than one node), the Postgres adapter, and per-namespace admin separation.
- **Primary sources:**
  - <https://socket.io/docs/v4/>
  - <https://socket.io/docs/v4/server-installation/>
  - <https://socket.io/docs/v4/client-installation/>

## PostgreSQL

- **Current Docker Hub `latest` tag:** **PostgreSQL 18.4** (`postgres:18.4`, `postgres:18`, `postgres:latest`, `postgres:18-trixie` on 2026-08-09).
  Verified at <https://hub.docker.com/_/postgres>.
- **Maintained majors on Docker Hub today (2026-08-09):** 18.4 (`latest`), 17.10, 16.14, 15.18, 14.23 — five majors live in parallel, all with Debian- and Alpine-based tags.
- **PostgreSQL Global Development Group versioning policy:** each major is supported for 5 years from first release.
  - 18 (released 2025-09-25): supported through 2030-11-14.
  - 17 (released 2024-09-26): supported through 2029-11-08.
  - 16 (released 2023-09-14): supported through 2028-11-09.
  - 15 (released 2022-10-13): supported through 2027-11-11.
  - 14 (released 2021-09-30): supported through 2026-11-12.
    Verified at <https://www.postgresql.org/support/versioning/> on 2026-08-09; the page banner notes "PostgreSQL 19 Beta 2 Released!" on 2026-07-16.
- **Bootstrap recommendation:** pin to **PostgreSQL 17** in the production compose file as the conservative choice (one major behind `latest`, longest remaining coverage window without going bleeding-edge). Use the `postgres:17.10-bookworm` tag to keep the OS reproducible. Local/test compose may use the same tag for parity.
- **Defer until package setup:** any extension beyond what `postgres-contrib` provides on the `postgres:17-bookworm` image. Avoid the `alpine` tag for a development DB unless the team is comfortable with musl's locale limitations (the docker-library README explicitly notes that musl-based images before PG 15 do not support locales, and PG 15+ only with ICU).
- **Known traps (verified from the official docker-library README on 2026-08-09 at <https://hub.docker.com/_/postgres>):**
  - **`PGDATA` path changed in PG 18.** PG 18 uses `/var/lib/postgresql/18/docker` (and a `VOLUME` at `/var/lib/postgresql`). For PG 17 and earlier the canonical volume mount is `/var/lib/postgresql/data`. **Mounting at the wrong path means data is lost when the container is recreated**, because the entrypoint will create an anonymous volume at the intended path. This is the most common production data-loss cause with the official image; a Postgres 17 deployment must mount `/var/lib/postgresql/data` explicitly.
  - Mounting `/var/lib/postgresql` (the parent) on PG 17 and earlier **does not persist**; the docker-library README calls this out as a "WILL NOT PERSIST" trap. The intent of the new PG 18 path layout is to allow `--link` for `pg_upgrade` across major versions.
  - `POSTGRES_HOST_AUTH_METHOD=trust` is dangerous in any environment that allows non-localhost connections; the docker-library README explicitly warns against it.
  - Use `_FILE` variants (`POSTGRES_PASSWORD_FILE=…`) to read secrets from Docker secrets files; supported for `POSTGRES_INITDB_ARGS`, `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`.
  - `POSTGRES_INITDB_ARGS=--data-checksums` is the recommended boot-time setting for new databases; enables page-level corruption detection.
  - Initialisation scripts under `/docker-entrypoint-initdb.d` only run when the data directory is empty. A failed init script that crashes the container will not re-run on the next start because the directory is no longer empty — a real production data-loss trap on first launch.
- **Primary sources:**
  - <https://hub.docker.com/_/postgres>
  - <https://www.postgresql.org/support/versioning/>

## Drizzle ORM + drizzle-kit

- **Current stable major:** Drizzle ORM is on the **1.x** line. The official site top banner reads "We've merged alternation-engine into Beta release" pointing at the v1.0 beta; the install commands on the official PostgreSQL get-started page use `drizzle-orm@rc` and `drizzle-kit@rc` (release-candidate) as of 2026-08-09.
  Verified at <https://orm.drizzle.team/docs/get-started-postgresql> and <https://orm.drizzle.team/docs/overview> on 2026-08-09.
- **PostgreSQL driver choice:** Drizzle supports two official drivers:
  - `node-postgres` (`pg`) — the classic Node driver. Supports per-query type parsers without global patching. The `pg-native` add-on gives ~10% faster Drizzle queries per the official docs.
  - `postgres.js` (`postgres`) — uses prepared statements by default. The official docs call out a real gotcha: **prepared statements can be a problem in some environments (PgBouncer in transaction-pooling mode, certain AWS RDS Proxy configs, and pgbouncer-like proxies)**. If production goes through a pooler, prepared-statement caching must be opted out or the pooler must support them.
- **Bootstrap recommendation:** use `drizzle-orm` + `drizzle-kit` and the `node-postgres` (`pg`) driver for v1 because:
  1. The dev/ops ecosystem (PgBouncer-style poolers, IAM auth) is friendlier without prepared statements.
  2. The official "PostgreSQL — Connect" page is explicit that per-query type parsers are easier with `node-postgres`.
     Code-first schema with `drizzle-kit generate` for migrations; do not use `push` against production (it does not produce reviewable SQL).
- **Version-compat traps:**
  - Drizzle 1.0 introduces "alternation-engine" and revamped relational queries. v0 → v1 changes are documented at <https://orm.drizzle.team/docs/upgrade-v1> and v0 → v1 changes at <https://orm.drizzle.team/docs/v0-v1-changes>. Do not mix v0 and v1 examples.
  - `drizzle-kit push` writes directly to the DB and is fine for local development; **never** for production. Always `generate` + review + `migrate`.
  - `drizzle-kit@rc` tag in the install command means the stable 1.x GA may not yet be out; pin a specific version (e.g. `1.0.0-beta.2`) rather than the `rc` dist-tag once the GA is announced.
- **Defer until package setup:** the RLS helpers, edge/Neon adapters, Drizzle Studio, and the GraphQL extension. The Drizzle "Validations" docs explicitly list Zod, Valibot, TypeBox, ArkType, typebox-legacy, and effect-schema as the integration targets — pick the same one used in the API to keep a single source of truth.
- **Primary sources:**
  - <https://orm.drizzle.team/docs/overview>
  - <https://orm.drizzle.team/docs/get-started-postgresql>
  - <https://orm.drizzle.team/docs/upgrade-v1>
  - <https://orm.drizzle.team/docs/v0-v1-changes>

## TanStack Query

- **Current stable major:** TanStack Query on the **"Latest"** channel of `tanstack.com/query/latest`. The current page banner advertises 2.5B total downloads and 68M weekly downloads. Exact version numbers are not shown on the public landing page; the canonical source for "current version" is the GitHub releases page <https://github.com/TanStack/query/releases> or the npm dist-tag.
- **Next.js App Router integration:** TanStack Query ships first-class support for React Server Components and the App Router via `@tanstack/react-query` plus `@tanstack/react-query-devtools`. The "Latest" docs at <https://tanstack.com/query/latest> link directly to the React framework overview; the per-framework guide is at <https://tanstack.com/query/latest/docs/framework/react/overview>.
- **Bootstrap recommendation:** use the official Next.js App Router pattern: a server-rendered `QueryClient` provider, hydration boundary, and `useQuery`/`useMutation` on the client. Do not also install SWR or `react-async` — TanStack Query is the single source of truth.
- **Version-compat traps:** TanStack Query has had API changes between major versions (e.g. v4 → v5). Pin to a specific `^5` or whatever the `Latest` channel shows on the day of bootstrap. Do not use an old tutorial without checking the version banner.
- **Defer until package setup:** Devtools in production, `persistQueryClient` (needs careful SSR handling), and the experimental streaming `dehydrate`/`hydrate` flows.
- **Primary sources:**
  - <https://tanstack.com/query/latest>
  - <https://tanstack.com/query/latest/docs/framework/react/overview>
  - <https://github.com/TanStack/query/releases>

## Docker Compose

- **Current spec:** Docker Compose v2, defined in `compose.yaml` (not the legacy `docker-compose.yml` plus `docker-compose` Python tool). The official docs at <https://docs.docker.com/compose/> describe the v2 tool that ships with Docker Desktop and the `docker compose` CLI plugin.
- **Bootstrap recommendation:** commit `compose.yaml` plus a small per-environment extension file (e.g. `compose.local.yaml` for development, `compose.prod.yaml` for the VPS). Use the long-form YAML services (not the now-deprecated short form). Define named volumes and a project name. Use `healthcheck:` plus `depends_on: { service: { condition: service_healthy } }` so the API waits for Postgres readiness before starting.
- **Version-compat traps:**
  - Do not use the obsolete top-level `version: "3.x"` field; it has been ignored for several Compose v2 minors and the docs no longer recommend it.
  - The `healthcheck` block in compose v2 uses `test: ["CMD", …]`; the older `curl`/`wget` heuristics are not needed. The Drizzle `node-postgres` driver is what actually performs the runtime check from the API container.
  - Traefik labels belong in the production compose override, not the shared compose file, so the dev/test stacks do not require Traefik to be running. The deployment doc at <https://docs.docker.com/compose/> makes this pattern obvious.
- **Defer until package setup:** multi-host deploy, `docker swarm`, and any Kubernetes-shaped path. The project explicitly does not want these for v1.
- **Primary sources:**
  - <https://docs.docker.com/compose/>
  - <https://docs.docker.com/reference/compose-file/>

## Mailpit (local SMTP)

- **Official image:** `axllent/mailpit` on Docker Hub, single-image multi-arch.
  Verified at <https://hub.docker.com/r/axllent/mailpit> on 2026-08-09.
- **Image size:** ~13.1 MB compressed, multi-arch.
- **Default ports:**
  - **SMTP:** `1025` (plain, accept-any auth by default; STARTTLS optional).
  - **Web UI:** `8025` (HTTP; HTTPS and basic auth optional).
- **Persistence:** the official image accepts `MP_DATABASE=/data/mailpit.db` to persist captured messages in a single SQLite file under `/data`. Default is in-memory, so container recreation loses captured messages. The official Docker Hub page and the `mailpit.axllent.org/docs/install/docker/` page both document this.
- **Bootstrap recommendation:** add Mailpit only to `compose.local.yaml` and `compose.test.yaml`. Do **not** put it in `compose.prod.yaml`. The API container connects to `mailpit:1025` over the compose network. Bind `8025` to `127.0.0.1:8025` on the host so the web UI is not exposed externally.
- **Trap:** Mailpit default behaviour prunes the most recent 500 messages (per the official Docker Hub description). For deterministic integration tests, set `MP_MAX_MESSAGES=…` higher or wipe `/data/mailpit.db` between tests.
- **Defer until package setup:** POP3 server, SMTP relaying/forwarding, webhooks, and chaos features (none of which are needed for v1's invite/verification/reset emails).
- **Primary sources:**
  - <https://hub.docker.com/r/axllent/mailpit>
  - <https://mailpit.axllent.org/docs/install/docker/>

## GitHub Actions + Docker Hub publishing

- **Recommended action majors (verified from each action's README on 2026-08-09):**
  - `actions/checkout@v6`
  - `docker/setup-buildx-action@v4`
  - `docker/setup-qemu-action@v4` (only if multi-arch is needed)
  - `docker/login-action@v4` — for Docker Hub
  - `docker/build-push-action@v7` — supports multi-platform, secrets, cache, provenance, SBOM
  - `docker/metadata-action@v5` — for tag and label generation
- **Bootstrap recommendation:** two separate jobs (or a matrix) — one for the web image, one for the API image. Each builds with `docker/build-push-action@v7` against a per-app `Dockerfile` rooted in the corresponding package directory, pushes to `docker.io/<docker-user>/<app-web-or-api>:vX.Y.Z` and a commit-SHA tag, and uses `docker/metadata-action@v5` to generate the tag list. Cache via `type=gha` for GitHub-native cache; switch to `type=registry` only if the project needs shared cache across forks.
- **Trap:** the default `docker/build-push-action` "git context" mode uses the workflow's git ref — any file mutations from earlier steps (including `.dockerignore` processing by `actions/checkout`) are **not** picked up. Use `context: .` and `actions/checkout` first if any pre-build mutation is needed. The action's README states this explicitly.
- **Provenance / SBOM:** both are supported via the `provenance: true` and `sbom: true` inputs (or `attests: type=…`). The Mugful deployment promise already commits to "scanned before publication"; enabling SBOM attestation gives the scanner something to scan against a signed attestation.
- **Secrets:** Docker Hub credentials must come from repository secrets (e.g. `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` or a Personal Access Token). Never bake a token into the workflow file.
- **Defer until package setup:** multi-arch builds (`platforms: linux/amd64,linux/arm64`), registry mirroring, and signed image signing via cosign beyond what `provenance` already provides.
- **Primary sources:**
  - <https://github.com/docker/build-push-action>
  - <https://github.com/docker/login-action>
  - <https://github.com/docker/setup-buildx-action>
  - <https://docs.docker.com/build/ci/github-actions/>

---

## Cross-cutting traps that affect more than one component

1. **TypeScript version drift:** Zod 4 (TS 5.5+), TypeBox 1.x (TS 6.0–7.0+), Valibot 1.x (TS 5.x+), and the various Fastify type providers all have their own minimum-TS floor. Pick a single TS version (5.5+ is the safe minimum) and confirm every type provider supports it before pinning.
2. **Node version vs pnpm 11:** pnpm 11 requires Node 22+. The web/API Dockerfiles must use `node:22-bookworm-slim` (or newer), never `node:18` or `node:20`. The bookworm-slim image does **not** ship `libatomic1` by default; install it explicitly before `pnpm install`.
3. **PostgreSQL volume path:** the PGDATA path convention differs between PG 17 (`/var/lib/postgresql/data`) and PG 18 (`/var/lib/postgresql/18/docker`). Pin the Postgres major before writing the compose file; the volume mount path depends on it.
4. **Prepared statements vs pooling:** if the project ever goes through PgBouncer in transaction-pooling mode, `postgres.js` (Drizzle's other supported driver) needs `prepare: false`. Choose the driver with that in mind.
5. **Zod 4.2 encode/decode flip:** `fastify-type-provider-zod` v7+ now serialises responses from `z.output<T>` (post-transformation) rather than `z.input<T>`. Schemas that use `z.coerce.*` will surface the coerced shape, not the raw input. Lock the Zod major at the start so the type behaviour does not silently change mid-development.
6. **OpenAPI version target:** `@fastify/swagger` lets you target OpenAPI 3.0 or 3.1 via the `openapi` config field. JSON Schema differences (`nullable` vs `type: [..., null]`) leak through. Pick the target before generating any client SDKs.
7. **GitHub Actions checkout context:** `docker/build-push-action` defaults to the git ref as the build context. Use `context: .` + `actions/checkout@v6` to make file mutations and `.dockerignore` work as expected.
8. **Image tag discipline:** the production compose file must reference an immutable tag (`vX.Y.Z` or `<sha>`), never `latest`. The CI workflow must produce both per the deployment promise in `README.md`.

## Open questions for the planning session

The following are not decided in this research note; they are for the planning step to confirm:

- **Validator choice** — Zod 4 vs TypeBox 1.x vs Valibot 1.x. This note leans Zod 4 because the official Fastify docs use it; the planning step should confirm or override.
- **PostgreSQL major** — 18 (current `latest`, bleeding edge) vs 17 (recommended here for stability headroom) vs 16 (oldest still in the first half of its window). The 5-year EOL table makes 17 and 18 both viable.
- **Drizzle driver** — `node-postgres` (recommended) vs `postgres.js`. The choice interacts with any future pooling layer.
- **TanStack Query version** — pin from the `Latest` channel on the day of bootstrap; revisit monthly.
- **Turborepo cache** — local-only at bootstrap; remote cache deferred until the team grows.
- **Mailpit port binding** — bind `8025` to `127.0.0.1` only on the local host. Confirm with the deployment doc.
- **OpenAPI UI surface** — public in dev, gated in prod. The path (`/docs`) and the auth (basic auth? a session cookie?) are not decided here.
- **Docker Hub namespace** — the deployment promise uses `<docker-user>/<app-web-or-api>`. The actual namespace is operational config and not in this note.

## Sources index

Primary sources cited inline; consolidated here for review:

- pnpm: <https://pnpm.io/installation>, <https://pnpm.io/workspaces>
- Turborepo: <https://turborepo.com/docs>
- Next.js: <https://nextjs.org/docs>, <https://nextjs.org/docs/app/getting-started/deploying>, <https://nextjs.org/docs/app/guides/upgrading/version-16>
- Fastify: <https://fastify.dev/docs/latest/>, <https://fastify.dev/docs/latest/Reference/Type-Providers/>
- Fastify type providers: <https://github.com/turkerdev/fastify-type-provider-zod>
- Validators: <https://zod.dev/>, <https://valibot.dev/>, <https://github.com/sinclairzx81/typebox>
- OpenAPI for Fastify: <https://github.com/fastify/fastify-swagger>
- Socket.IO: <https://socket.io/docs/v4/>, <https://socket.io/docs/v4/server-installation/>, <https://socket.io/docs/v4/client-installation/>
- PostgreSQL: <https://hub.docker.com/_/postgres>, <https://www.postgresql.org/support/versioning/>
- Drizzle: <https://orm.drizzle.team/docs/overview>, <https://orm.drizzle.team/docs/get-started-postgresql>, <https://orm.drizzle.team/docs/upgrade-v1>, <https://orm.drizzle.team/docs/v0-v1-changes>
- TanStack Query: <https://tanstack.com/query/latest>, <https://tanstack.com/query/latest/docs/framework/react/overview>
- Docker Compose: <https://docs.docker.com/compose/>, <https://docs.docker.com/reference/compose-file/>
- Mailpit: <https://hub.docker.com/r/axllent/mailpit>, <https://mailpit.axllent.org/docs/install/docker/>
- GitHub Actions Docker tooling: <https://github.com/docker/build-push-action>, <https://github.com/docker/login-action>, <https://github.com/docker/setup-buildx-action>, <https://docs.docker.com/build/ci/github-actions/>

---

**Note for future readers:** every version number and port in this document is the value on the linked page on **2026-08-09**. Before bootstrapping the monorepo, re-check the linked source for the same fact and update the date if the answer has moved. Do not use a stale local copy of this note as the source of truth.
