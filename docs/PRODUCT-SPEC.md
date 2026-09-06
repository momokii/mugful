# Mugful — Product Specification

**Status:** Confirmed direction; implemented product is in stabilization before invite-only beta
**Audience:** Adults in long-distance romantic relationships
**Release target:** v1 invite-only beta, with public registration feature-flagged off by default
**License target:** Apache-2.0

## Problem Statement

Couples in long-distance relationships often have communication tools, but few small, intentional experiences that help them feel together when they cannot meet. A general-purpose portal with many unfinished activities would create scope without proving that it helps couples connect.

The first product must therefore own one repeatable moment: two partners answer a playful question independently and discover their answers together, whether they are online at the same time or responding hours apart.

## Solution

Build a private, invite-based web space for two adult romantic partners. The first version centers on one activity, **Guess My Answer**, supported by presence, realtime status, notifications, history, privacy controls, and a curated prompt library.

The product should feel warm, playful, and mature. It should be lively through meaningful interaction—presence, answer state, reveal feedback, and reactions—not through an overloaded collection of games or decorative animation.

## Product Principles

1. **Connection before competition.** The app should create a conversation, not determine a winner.
2. **One excellent activity before many mediocre activities.** New activities must earn their place through observed usage.
3. **Async-first, realtime-enhanced.** The product remains useful when schedules do not align.
4. **Privacy is a product feature.** Couple content is private by design, and superadmin access is operational only.
5. **Open source by default.** The first public commit must be understandable without private context; the first runnable release must be installable from the documented instructions.
6. **No hidden complexity.** Infrastructure, external services, security assumptions, and deferred work must be documented.

## User Stories

### Identity and onboarding

1. As an adult user, I want to create an account with my email and password, so that I can return to my private couple space.
2. As a user, I want secure email verification and password recovery, so that I can safely regain access.
3. As a user, I want to affirm that I am at least 18, so that the first release has a clear adult-only boundary.
4. As a user, I want to provide only an email, display name, and optional avatar, so that the service does not collect unnecessary profile data.
5. As a user without a couple space, I want to choose between creating one and joining one, so that onboarding leads directly to the product’s purpose.
6. As a user, I want to create a couple space and generate an invite, so that my partner can join privately.
7. As an invited partner, I want to inspect an invite without seeing private content, so that I can decide whether to accept it safely.
8. As an invited partner, I want to join through a single-use expiring link, so that stale or forwarded invitations cannot remain valid forever.
9. As a user, I want an invite to be delivered by copyable link or optional email, so that I can choose the communication channel I trust.

### Couple space

10. As a user, I want one active couple space per account in v1, so that relationship ownership and privacy remain unambiguous.
11. As a user, I want to see my partner’s private ephemeral presence, so that I know whether a live interaction is possible.
12. As a user, I want to hide my presence, so that I retain control over when I appear available.
13. As a user, I want the shared home to show the current together moment, so that I am not confronted with an overwhelming portal of unfinished features.
14. As a user, I want to see pending rounds and recent moments, so that asynchronous activity remains visible without becoming a social feed.
15. As a user, I want to leave or end a couple space, so that I can immediately stop access after a relationship or account-safety change.
16. As a user, I want ending a space to revoke access immediately, so that a former partner cannot continue using the space.
17. As a user, I want the space’s shared data to enter a documented deletion grace period, so that accidental endings can be handled without indefinite retention.

### Guess My Answer

18. As a user, I want to start a round on demand, so that the activity fits our schedule rather than creating an obligation.
19. As a user, I want a random prompt by default, so that starting a round feels effortless.
20. As a user, I want to choose a prompt category, so that we can select an appropriate mood.
21. As a user, I want to skip a prompt, so that the activity remains comfortable and voluntary.
22. As a user, I want recently used prompts to be avoided, so that rounds do not feel repetitive.
23. As a user, I want to answer privately, so that my answer is not influenced by seeing my partner’s answer.
24. As a user, I want to edit my answer until I submit it, so that I can correct my own draft.
25. As a user, I want my submitted answer to lock, so that the reveal remains fair.
26. As a user, I want to know that my partner has submitted without seeing their answer, so that asynchronous waiting still feels alive.
27. As a user, I want both answers to reveal only after both partners submit, so that the reveal is shared.
28. As a user, I want to see whether we matched without a winner, so that the activity encourages conversation rather than competition.
29. As a user, I want to react after the reveal, so that the round can continue into a small shared moment.
30. As a user, I want an unanswered round to remain available without a deadline, so that different schedules do not create pressure.
31. As a user, I want to cancel a pending round, so that I can start fresh when the context changes.
32. As a user, I want inactive unanswered rounds archived after a quiet period, so that the home stays useful.

### Notifications and realtime behavior

33. As a user, I want live updates when my partner starts or submits a round, so that the app feels present when we are both online.
34. As a user, I want meaningful notifications without answer content, so that email never leaks private moments.
35. As a user, I want to control email notifications, so that the app respects my attention and privacy.
36. As a user, I want the app to recover from ordinary reconnects, so that a temporary network change does not corrupt a round.
37. As a user, I want the server to remain authoritative, so that two devices cannot create contradictory round states.

### Privacy and account control

38. As a user, I want a Privacy Center, so that I can understand and exercise my data rights without contacting an administrator for every action.
39. As a user, I want to export my data, so that I can keep a copy of information associated with my account.
40. As a user, I want to correct profile data, so that the service keeps accurate information.
41. As a user, I want to withdraw consent and delete my account, so that I can end processing and remove my data.
42. As a user, I want private couple content excluded from superadmin tools, so that operational support does not become content surveillance.
43. As a user, I want privacy and consent notices in Bahasa Indonesia, so that the legal basis for processing is understandable.
44. As a user, I want a clear explanation that v1 does not record video or use AI, so that the current data boundary is explicit.

### Administration and open source

45. As a superadmin, I want to manage the curated prompt catalog, so that prompt quality can improve without code deployment.
46. As a superadmin, I want prompt changes to be versioned and audited, so that existing rounds remain understandable.
47. As a superadmin, I want to toggle global registration and activity feature flags, so that release exposure can be controlled safely.
48. As a superadmin, I want MFA-protected operational tools, so that configuration access is harder to compromise.
49. As an operator, I want documented Docker deployment and rollback steps, so that I can run the app on my VPS without relying on private knowledge.
50. As an open-source contributor, I want the README to explain the stack, dependencies, setup, testing, and deployment, so that I can run the project independently.
51. As a future maintainer, I want current status, decisions, roadmap, and known risks documented, so that work can continue across sessions.
52. As a user, I want to switch between light and dark themes, so that the private space is comfortable in different environments.
53. As a user, I want to view and revoke individual device sessions, so that I can remove access from a lost or shared device.
54. As an authenticated user, I want to change my password without using account recovery, so that I can maintain account security proactively.

## Implementation Decisions

### Product scope

- v1 is for two-person romantic LDR couples, adults only.
- Each account has one active couple space in v1.
- The v1 activity is Guess My Answer.
- The activity is hybrid: HTTP-backed asynchronous actions with realtime enhancement.
- Answers remain private until both partners submit; submitted answers are immutable.
- There is no score, leaderboard, streak, or winner.
- Prompts are curated, categorized, non-explicit, and managed by superadmins.
- The default registration mode is invite-only. A global audited feature flag can enable open registration.
- The first release is an invite-only beta even though the source repository is public from its first commit.

### Web and backend architecture

- Use TypeScript end to end.
- Use a Next.js/React web application and a Fastify API/realtime application in one monorepo.
- Use pnpm workspaces and Turborepo for package management and task orchestration.
- Keep HTTP commands as the source of business state changes.
- Use Socket.IO for presence and post-commit notifications, not as the source of truth.
- Use a server-authoritative finite state machine for round lifecycle.
- Use versioned REST JSON APIs with OpenAPI and shared runtime validation.
- Use PostgreSQL with Drizzle ORM and explicit versioned migrations.
- Use TanStack Query for server-state caching and local React state for UI-only state.
- Do not add Redis in v1. A future multi-instance deployment may add a Socket.IO adapter.

### Authentication and authorization

- Use email/password accounts with database-backed opaque sessions.
- Store only hashed session tokens; use secure HTTP-only cookies, rotation, expiry, CSRF protection, and per-device revocation.
- Use Argon2id or another approved memory-hard password hashing strategy.
- Require email verification and secure password reset flows.
- Registration, password reset, and authenticated password-change forms require a matching confirmation password before sending the existing single-password API payload; mismatches focus the confirmation field, clear when corrected, and remain associated with the field for assistive technology. Password inputs provide show/hide controls, autofill-compatible semantics, and 12-character guidance. Registration success explains the verification-link flow without claiming account creation, while responses remain generic for duplicate normalized emails to prevent account enumeration; forced first-login password changes are not part of the current identity scope.
- Use single-use, short-lived, cryptographically random invite and reset tokens stored only as hashes.
- Require passkey MFA with TOTP recovery for superadmins.
- Enforce couple membership and content authorization in backend modules and database access patterns.

### Privacy and security

- Treat the app operator as an Indonesian UU PDP Controller and external infrastructure/email providers as Processors where applicable.
- Use Bahasa Indonesia as the primary privacy and consent language; English can be secondary.
- Record consent versions and withdrawal events.
- The v1 Privacy Center will provide export, correction, withdrawal, deletion, and processing restriction. The implemented Todo 5F foundation is read-only and excludes those operations until their later v1 slice.
- Default retention is user-controlled with a 90-day default for recent activity; ending a space triggers immediate access revocation and a documented deletion grace period.
- Use field-level application encryption for private content, with keys outside PostgreSQL and inaccessible through the superadmin UI.
- Superadmins can manage operational metadata, prompts, feature flags, health, and audit data, but cannot read private couple content through the application.
- The infrastructure operator remains trusted in v1; true end-to-end encryption is future work.
- Do not log prompt answers, private content, passwords, tokens, camera media, or unnecessary identifiers.
- Use structured redacted logs, request IDs, health checks, basic metrics, and privacy-minimized uptime monitoring.
- Apply secret scanning, dependency auditing, SAST, container scanning, and pre-release threat modeling.

### Deployment and external services

- Use Docker Compose with shared base, development, test, and production configurations.
- Run separate web and API containers plus PostgreSQL; Mailpit is development-only.
- Deploy to a personal VPS behind Traefik using one public origin and path routing.
- Use CI-built public Docker Hub images with semantic-version and commit-SHA tags.
- Production must pin an exact image tag; `latest` is never the deployment source of truth.
- Use a manual deployment script that validates secrets, backs up the database, runs compatible migrations, performs health checks, and keeps rollback information.
- Use an external VPS secret file with restrictive permissions; never commit secrets or put them in images.
- Use encrypted daily offsite backups and a tested restore procedure.
- Use an encrypted offsite escrow/recovery process for the private-content encryption key.
- Use Mailpit locally and a provider-neutral SMTP interface in production. Resend Free is the documented first production candidate; Brevo and Google Workspace relay are alternatives.
- Document every external service with setup, DNS, environment variables, security, limits/costs, testing, troubleshooting, rotation, and removal instructions.
- Treat breach response as a v1 launch requirement: maintain a UU PDP Pasal 46 runbook with a 3×24-hour notification target, data-subject and regulator contact paths, and Bahasa Indonesia notice templates.
- Before production processing, complete counsel-reviewed processor and transfer treatment for the VPS and production SMTP provider, including cross-border safeguards where applicable.

### UI and UX

- The visual direction is warm, playful, and mature.
- Support complete light and dark themes from v1.
- Use a custom design system built on accessible primitives; do not ship default component-library styling.
- Use purposeful moderate motion and respect `prefers-reduced-motion`.
- Use WCAG 2.2 AA as the baseline for contrast, keyboard navigation, focus, labels, touch targets, and screen-reader behavior.
- Use a public landing page, authentication, and a private app shell.
- User navigation is Home, Moments/history, and Settings; activity selection is contextual from Home.
- The round UI follows: choose prompt → answer privately → waiting → reveal → react.
- Every important screen requires intentional loading, empty, error, disabled, and reconnect states.
- A root design system document must exist before UI components are implemented.

### Future provider-neutral AI seam

- AI is not enabled in v1.
- Future AI work must support OpenAI, Anthropic, and Gemini behind a backend provider interface selected through configuration.
- AI keys stay server-side, prompts are minimized and redacted, outputs are schema-validated, and transfers are consented and documented.
- A DPIA and Indonesian legal review are required before enabling AI in production.

## Testing Decisions

### Test quality

Tests must verify observable behavior at stable public seams. They must not inspect private implementation details, mock the entire system into tautological success, or delete failing tests to make CI pass. Work should proceed in vertical red-green-refactor slices.

### Required test surfaces

- Domain/state-machine tests for valid and invalid round transitions.
- API integration tests against real PostgreSQL for authentication, invitations, authorization, round commands, consent, privacy requests, deletion, and retention.
- REST/OpenAPI contract validation between web and API.
- Socket.IO tests for presence, post-commit notifications, reconnect behavior, and event authorization.
- Browser tests for registration, invite acceptance, create-or-join onboarding, full Guess My Answer flow, privacy controls, theme behavior, and critical error states.
- Manual responsive and accessibility checks at mobile, tablet, and desktop sizes.
- CI lint, typecheck, unit/integration tests, browser tests, build, Docker validation, secret scanning, dependency scanning, and image scanning.
- Deployment verification for database backup, migration, health checks, and restore.

### Stability gate before v1.1

Do not begin native video work until v1 has no open critical/high bugs, passes core browser and real-device checks, passes security/privacy gates, has verified deployment and restore, and has documentation matching released behavior.

## Out of Scope

- Native video or audio calls in v1.
- Screen sharing, recording, group calls, video filters, call playback, and in-call chat.
- True end-to-end encryption in v1.
- AI-generated prompts, AI companions, or any production AI provider in v1.
- Behavioral analytics, session replay, or ad tracking.
- Multiple activities or a game catalog in v1.
- User-generated prompts in v1.
- Public profiles, matchmaking, social graphs, or group spaces.
- Children’s accounts or parental-consent flows.
- Multiple active couple spaces per account.
- Microservices, Kubernetes, Redis, or horizontal scaling before measured need.
- Public registration as the initial default; the feature flag exists but begins disabled.

## Further Notes

- Native video is planned for v1.1 as a bounded “Together Room” only after the stability gate. It will use WebRTC media, Socket.IO signaling, STUN/TURN, no recording, explicit pre-call consent, audio-only fallback, and a real cross-device test matrix.
- True end-to-end encryption is a later security milestone requiring key exchange, multi-device support, recovery, deletion, and migration design.
- The Indonesia PDP checklist and SMTP research are source-backed research notes, not legal advice or permanent pricing commitments. Counsel-needed items must be reviewed before launch.
- This specification records agreed direction. Implementation details may be refined through ADRs, but changes must preserve the product principles and update the relevant documentation.
