# Roadmap

This roadmap is intentionally outcome-based. A milestone is not complete because code exists; it is complete when the user journey, security controls, deployment, tests, and documentation are verified.

## Current status

**Phase:** Foundation through Todo 9 deployment and operations, v1.1 Together Room 11A–11D, and privacy-request operations are implemented and verified; v1 stability gate is next.

Completed discovery artifacts:

- Product specification.
- Indonesia UU PDP research checklist.
- SMTP provider research.
- Confirmed architecture, security boundary, deployment model, and v1.1 direction.

## Phase 0 — Documentation and foundation

### Outcomes

- Repository orientation is possible from `CLAUDE.md`, `README.md`, and the documentation index.
- Product scope and architectural decisions are explicit.
- Design tokens exist before UI components.
- Open-source hygiene is present before the first public commit.

### Required artifacts

- Product specification and architecture documentation.
- Design system.
- Security policy, contribution guidance, and Apache-2.0 license.
- Environment-variable reference and external-service runbooks.
- Decision records for choices that may be revisited.

## Phase 1 — v1 vertical slices

Build in small, user-visible slices rather than horizontal infrastructure batches:

1. Project tooling, strict TypeScript, linting, formatting, CI, and Docker development environment.
2. Account registration, email verification, secure sessions, password reset, and age gate.
3. Create-or-join couple onboarding with single-use invite links.
4. Shared home, presence, theme system, settings, and privacy foundation.
5. Prompt catalog and superadmin management with audit events.
6. Guess My Answer start, prompt selection, private answer submission, and locking.
7. Async waiting state, realtime notifications, simultaneous reveal, match indicator, and reaction.
8. Moments/history, cancellation, archiving, retention, deletion, and Privacy Center.
9. Operational metrics, backup/restore, deployment script, Docker release images, and runbooks.

Each slice must include its behavior tests, documentation updates, accessibility states, and security review appropriate to its data.

### Todo 5 recovery checkpoints

- 5A: internal identity persistence primitives, reviewed migration, unit coverage, and real PostgreSQL schema verification.
- 5B1: identity policy persistence/configuration prerequisite, reviewed additive migration, unit coverage, and real PostgreSQL verification.
- 5B2: identity API behavior.
- 5C: email delivery integration.
- 5D: identity UI.
- 5E: negative-path matrix and JSON-only identity OpenAPI contract.
- 5F: Zod 4 compliance, separable Bahasa consent capture, read-only Privacy Center identity foundation, lifecycle reliability, final acceptance, and independent final review.

Checkpoints 5A, 5B1, 5B2, 5C, 5D, 5E, and 5F are complete and accepted. Todo 6 couple onboarding is also complete. Todo 7 prompt administration and Todo 8 Guess My Answer are complete and verified. Todo 9 deployment and operations is the current implementation slice:

- 7A: prompt catalog persistence — versioned immutable prompt versions with one active version per prompt, audit events, reviewed migration, schema module unit coverage, and real PostgreSQL verification.
- 7B1: prompt catalog service — transactional create/update/retire/list with audit events, tested against real PostgreSQL.
- 7B2a: superadmin authorization persistence — grant/revocation, passkey credential, and TOTP recovery storage with audit events, schema module, and real PostgreSQL verification.
- 7B2b: superadmin MFA service — RFC 6238 TOTP verification with replay protection and the transactional grant/passkey/TOTP lifecycle, tested against real PostgreSQL.
- 7B2c: WebAuthn ceremonies — challenge-scoped registration and authentication orchestration with single-use challenge storage, counter-advance tracking, and failure auditing.
- 7B3a: superadmin MFA session verification persistence — expiring, revocable, session-scoped verification records with real PostgreSQL verification.
- 7B3b: superadmin HTTP surface — MFA-gated prompt administration routes, WebAuthn ceremony endpoints, session/grant/CSRF/MFA guards, and negative-path coverage.
- 7C: operational prompt tooling UI — the `/superadmin` console with passkey MFA ceremony, catalog CRUD, and the documented token system.

Todo 8 Guess My Answer is split into checkpoints:

- 8A: round persistence — rounds, per-participant answers, reactions, one-pending-per-space invariant, the documented state machine as pure transitions, and real PostgreSQL verification.
- 8B: round service — prompt suggestion with category/recent-avoidance, transactional start/submit/reveal/cancel/react, tested against real PostgreSQL.
- 8C: round HTTP surface — couple-membership authorization, CSRF, negative-path coverage.
- 8D: activity UI — the `/home` console covering suggestion, answer lock-in, waiting, reveal, matches, and reactions.
- 8E: realtime notifications — Socket.IO gateway with session-cookie handshake authorization, one room per couple space, post-commit event emission carrying event type and round id only, and client-side silent refresh.

Privacy-request operations cover export, correction, 30-day deletion, withdrawal, and idempotent restriction/lift with audit, tested against real PostgreSQL and exposed through the Bahasa-first Privacy Center.

Todo 9 covers production Dockerfiles with pinned bases and healthchecks, a production Compose file with Traefik labels and persistent volumes, a deployment script that validates its environment, backs up, migrates, starts, checks health and retains the previous release, and encrypted backup/restore scripts with retention. v1.1 Together Room 11A–11D are implemented and verified (signaling, state machine, media UI, TURN); final cross-device verification is next before the v1.1 stability gate.

## Phase 2 — v1 invite-only beta

Release to a small set of real couples while keeping public registration disabled. Observe:

- whether both partners complete the first round;
- whether couples return for a later round;
- whether the async flow remains understandable;
- mobile browser and reconnect behavior;
- invite, deletion, and privacy-request reliability;
- prompt quality and comfort boundaries;
- operational error and support burden.

No behavioral analytics are required. Feedback can be collected through explicit, privacy-conscious channels.

## v1 stability gate

Begin no v1.1 subsystem until all conditions hold:

- No open critical or high-severity bugs.
- Core journey passes unit, integration, browser, and real-device checks.
- Authentication, authorization, privacy, deletion, and superadmin boundaries pass security review.
- Docker deployment, migration, backup, restore, and rollback are verified.
- Accessibility and visual QA pass at mobile, tablet, and desktop sizes.
- Documentation accurately describes the released behavior and current operational procedures.

## v1.1 — Together Room

### Goal

Let two partners optionally see and hear each other while using the shared space, without turning the product into a general video platform.

### Include

- 1:1 audio/video only.
- WebRTC media with Socket.IO signaling.
- STUN and a monitored TURN service.
- Ringing, accepted, connecting, connected, ended, and failed states.
- Camera and microphone controls.
- Audio-only fallback.
- One reconnect/ICE-restart attempt.
- Explicit pre-call consent and a persistent no-recording indicator.
- Minimal call metadata only; never store media.
- Cross-device testing including iOS Safari and two different networks.

### Exclude

- Recording or playback.
- Group calls.
- Screen sharing.
- Filters, virtual backgrounds, or video effects.
- In-call chat.
- Streaming or public rooms.

## Later milestones

### True end-to-end encryption

Design key exchange, multi-device support, recovery, deletion, and migration before implementation. Do not claim the v1 application-level privacy boundary is end-to-end encryption.

### Additional activities

Only add a second activity after evidence that the first loop is used. Candidate activities must reuse couple membership, activity registration, authorization, realtime events, privacy, retention, and history contracts.

### AI capabilities

Potential future prompt assistance or other AI experiences require a DPIA, Indonesian legal review, processor agreements, explicit opt-in consent, payload minimization, structured outputs, and provider-neutral support for OpenAI, Anthropic, and Gemini.

### Behavioral analytics

Only consider analytics if operational and qualitative feedback cannot answer a specific product question. Any future analytics must have a documented purpose, lawful basis, consent behavior, retention, minimization rules, and opt-out path.
