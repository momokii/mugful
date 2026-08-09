# Architecture

**Status:** Confirmed target architecture; 0b local runtime boundary and Todo 5A identity persistence primitives implemented
**Scope:** v1 LDR couples beta

## Architecture summary

The system is a TypeScript monorepo containing a Next.js web application and a Fastify API/realtime application. The API is a modular monolith: HTTP commands, authorization, domain state transitions, and Socket.IO notifications live behind one backend boundary. PostgreSQL is the source of truth. Docker Compose runs the web app, API, database, and development-only Mailpit service.

```text
Browser
  │ one public origin
  ├── /           → Next.js web container
  ├── /api/*      → Fastify API container
  └── /socket.io  → Fastify + Socket.IO container

Fastify API
  ├── authentication and sessions
  ├── couple membership and authorization
  ├── Guess My Answer state machine
  ├── privacy requests and retention jobs
  ├── operational administration
  └── post-commit realtime notifications
        │
        └── PostgreSQL via Drizzle
```

Traefik remains the VPS-level reverse proxy. Its labels, external network name, and domain are deployment inputs rather than application assumptions.

## Implemented local runtime boundary

`compose.yaml` intentionally runs only PostgreSQL 17.10-bookworm, bound to localhost with password authentication, a named volume at `/var/lib/postgresql/data`, and a TCP-capable `pg_isready` check. It is not production Compose. Fastify liveness is database-independent; readiness runs a read-only check and returns generic 503 on failure. The Next rewrite maps `/api/:path*` to `${API_INTERNAL_ORIGIN}/:path*`, stripping `/api`. Manual `db:generate` and `db:migrate` commands own migrations; startup, development, Fastify construction, readiness, and Compose never run migration code.

## Architectural principles

1. **The database is authoritative.** Realtime transport never becomes a second source of truth.
2. **Commands are explicit.** Business mutations use authenticated HTTP commands with validation and transactions.
3. **Events are facts after commit.** Socket.IO notifications are emitted only after a successful state transition.
4. **Modules own policy.** Authentication, couple membership, activities, privacy, and administration have clear boundaries.
5. **Private content is not an admin query.** Superadmin features operate on approved metadata and cannot reach couple answers through normal application paths.
6. **The first deployment is boring.** One VPS, one backend instance, PostgreSQL, no Redis, no Kubernetes, and no speculative service mesh.
7. **Every external dependency has an exit plan.** Configuration, data flow, retention, cost, rotation, and removal steps must be documented.

## Service boundaries

### Web application

The web application owns routing, layouts, accessible interaction states, theme handling, client-side server-state caching, and browser-only capabilities. It must not contain database credentials, SMTP credentials, AI keys, or authorization decisions.

### API and realtime backend

The backend owns authentication, sessions, invite redemption, couple membership, prompt selection, round commands, privacy requests, admin authorization, and Socket.IO signaling for presence and post-commit events. It is the only component allowed to mutate domain state.

### PostgreSQL

PostgreSQL stores accounts, sessions, couple membership, invite metadata, prompt catalog versions, round state, consent records, privacy requests, operational configuration, audit events, and retention metadata. Private couple content is encrypted at the application layer before persistence.

### Mailpit and SMTP

Mailpit is development-only. Production uses the provider-neutral SMTP interface. Resend Free is the first documented candidate; Brevo and Google Workspace SMTP Relay are alternatives. Email delivery must never be required to run the local test suite.

## Domain state

The first activity is modeled as an activity module rather than as a collection of special-case pages. The shared activity contract should support:

- activity metadata and availability;
- start and cancellation commands;
- a server-authoritative state machine;
- participant-scoped answer submission;
- post-commit events;
- retention and deletion behavior;
- activity-specific UI states;
- future activity registration without changing authentication or couple membership.

The Guess My Answer state progression is:

```text
available → active → waiting-for-partner → ready-to-reveal → revealed → completed
              └──────────────────────────────→ cancelled
```

An answer is editable until its owner submits it. Submission makes it immutable. The reveal transition is permitted only when both partners have submitted.

Cancellation is valid from the pending pre-reveal states (`active` and `waiting-for-partner`) and is not available after reveal readiness. Archiving is a retention operation applied to inactive unanswered rounds, not a round-lifecycle state transition. A round becomes `completed` immediately after the reveal is committed; reactions are optional and never gate completion.

## API and realtime contract

- REST JSON APIs are versioned and described by OpenAPI.
- Request and response schemas are validated at runtime at the API boundary.
- Commands are idempotent where retries are expected.
- Authorization is checked on every command and every event subscription.
- Socket.IO carries presence, round-status notifications, and future signaling messages; it does not authorize or persist business changes.
- Event payloads contain the minimum data needed by the receiving couple member and never contain the other partner’s hidden answer.
- Event names and payloads are versioned through shared contracts.

## Authentication and session model

- Todo 5A persists accounts, independently versioned adult-attestation/terms/privacy consent records, sessions, and email-verification/password-reset token metadata. Account creation and all required consent inserts are deliberately left to a future atomic transaction boundary.
- Email/password accounts use a memory-hard password hash.
- Sessions are opaque random tokens in secure HTTP-only cookies.
- Only a session-token hash is stored in PostgreSQL.
- Sessions have expiry, rotation, device metadata, and per-device revocation.
- CSRF protection applies to cookie-authenticated mutations.
- Invite, verification, and reset tokens are single-use, short-lived, and stored only as hashes.
- Superadmin authentication requires passkey MFA with TOTP recovery.

Todo 5B2 exposes only the internal `/v1` identity checkpoint: CSRF issuance; config-gated registration; verified-account login; logout; current session; password change; active-device listing; and owned non-current device revocation. Every unsafe identity command requires an exact same-origin `Origin` header plus a signed CSRF token bound to a browser CSRF cookie. Login and registration use durable PostgreSQL rate-limit buckets keyed only by an HMAC of their normalized principal. Generic credential and registration responses avoid account enumeration. Password change creates a replacement opaque session and invalidates every prior account session in one transaction. Migrations remain explicit manual operations; startup and health boundaries do not execute them.

Session-cookie policy is deployment-specific and not caller-configurable: production uses the `__Host-mugful-session` name with `Secure`, `HttpOnly`, `SameSite=Lax`, and `Path=/` without `Domain`; the explicit local-development helper uses `mugful-session` with `secure: false` for local HTTP only.

## Privacy and authorization model

The application operator is treated as a UU PDP Controller. The VPS provider, SMTP provider, and future external processors require documented processor and transfer treatment. The privacy model is:

- A user can access only their own account and their active couple space.
- A couple member can read shared content only when the activity state permits it.
- Superadmins can manage prompts, feature flags, health, audit metadata, and support metadata.
- Superadmins cannot read private answers or private couple history through application interfaces.
- Infrastructure operators remain trusted in v1; true end-to-end encryption is deferred.
- Private content is encrypted at the application layer, with keys outside PostgreSQL and outside the admin UI.
- Consent, notice, access, correction, deletion, restriction, and withdrawal workflows are explicit product capabilities.
- Retention and deletion jobs include operational logs, invite secrets, database backups, and encryption-key recovery documentation.

The detailed legal research and counsel-needed questions are maintained in the Indonesia PDP checklist. It is not legal advice.

## Deployment model

### Compose environments

- Shared Compose configuration defines common service shape.
- Development configuration adds Mailpit, local ports, development volumes, and safe defaults.
- Test configuration provides isolated dependencies and deterministic cleanup.
- Production configuration uses pinned public Docker Hub images, persistent volumes, health checks, and optional Traefik labels.

### Images and releases

Web and API are separate public images:

```text
docker.io/<docker-user>/<app-web>:vX.Y.Z
docker.io/<docker-user>/<app-api>:vX.Y.Z
```

Each release also receives a commit-SHA tag. Production pins a semantic version or SHA; `latest` is never the production source of truth. Images are multi-stage, contain no secrets, and are scanned before publication.

### Deployment sequence

The deployment script must validate its environment, select an exact release, verify or create a backup, run compatible migrations, start the stack, check health, and retain the previous release for rollback. Destructive migrations require explicit operator confirmation.

### Backup and recovery

- PostgreSQL backups are encrypted, daily, offsite, and rotated.
- A documented restore procedure is tested periodically.
- Encrypted backups may retain deleted data for the backup retention period; this exception is documented in the retention schedule, and deletion metadata is reapplied on restore once the applicable deletion grace period has elapsed.
- Encryption-key recovery is separate from database backups and tested independently.

## Observability

The first release uses structured JSON logs, redaction, request/correlation IDs, service health endpoints, Docker health checks, basic operational metrics, and an external uptime monitor that sees only a public health endpoint. No prompt answers, private content, passwords, tokens, or behavioral analytics are logged. A v1 launch also requires a breach-response runbook covering UU PDP Pasal 46’s 3×24-hour notification target and Bahasa Indonesia notice templates; see the PDP checklist sections 7 and 14.

## External service inventory

| Service                 | Environment          | Purpose                         | Data boundary                                                         | Required now             |
| ----------------------- | -------------------- | ------------------------------- | --------------------------------------------------------------------- | ------------------------ |
| Docker Hub              | CI/production        | Public web/API images           | Image metadata only; no secrets                                       | Yes                      |
| Mailpit                 | Local/test           | Captured email inspection       | Local test messages only                                              | Yes for local            |
| Resend                  | Production candidate | Verification/reset/invite email | Email recipient and message content; cross-border treatment may apply | Yes for production email |
| Uptime monitor          | Production           | Availability checks             | Public health result only                                             | Optional                 |
| Traefik                 | VPS                  | TLS and routing                 | Request metadata/logs                                                 | User-managed             |
| OpenAI/Anthropic/Gemini | Future only          | Optional AI capabilities        | Explicitly consented, minimized payloads                              | No                       |
| coturn                  | Future v1.1          | WebRTC TURN relay               | Network/media relay metadata                                          | No                       |

Detailed setup runbooks must explain account creation, DNS, credentials, environment variables, testing, limits, rotation, failure modes, and removal for every service used.

Before production processes personal data, the chosen VPS and SMTP providers require counsel-reviewed processor and transfer treatment. If the provider processes data outside Indonesia, document the UU PDP Pasal 56 cross-border safeguards and any applicable coordination/reporting steps; see the PDP checklist section 8.

## Future evolution

- Add Redis only when a measured multi-instance requirement exists.
- Add native WebRTC video in v1.1 only after the v1 stability gate.
- Add true end-to-end encryption only after key exchange, multi-device, recovery, deletion, and migration designs are complete.
- Add AI only after a DPIA, legal review, provider DPAs, explicit consent, and a provider-neutral backend seam.
