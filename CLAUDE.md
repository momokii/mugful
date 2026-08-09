# Project orientation for future sessions

This repository is Mugful: a private web space for two adults in a long-distance romantic relationship. The v1 product centers on one activity, **Guess My Answer**, where both partners answer a curated prompt privately and reveal their answers together.

## Read first

1. `README.md` for the public project overview.
2. `docs/README.md` for the documentation index.
3. `docs/CURRENT-STATUS.md` for the current phase and completed work.
4. `docs/ROADMAP.md` for next outcomes.
5. `docs/PRODUCT-SPEC.md` for agreed behavior.
6. `docs/ARCHITECTURE.md` and `DESIGN.md` before changing backend or UI architecture.

## Current status

Product and architecture discovery is complete. Documentation exists; application implementation has not started. Do not describe the project as production-ready or claim that planned commands work until they are implemented and verified.

## Non-negotiable product decisions

- v1 serves adult romantic LDR couples.
- One active couple space per account.
- One v1 activity: Guess My Answer.
- Answers are editable until submission and immutable afterward.
- Answers reveal only after both partners submit.
- No score, winner, leaderboard, AI, behavioral analytics, native video, or multiple activities in v1.
- Registration defaults to invite-only but is controlled by an audited global feature flag.
- Superadmins manage operations and prompts, not private couple content.
- v1 uses application-level encryption; E2EE is future work.

## Non-negotiable engineering rules

- TypeScript strictness and runtime validation at external boundaries.
- No `as any`, `@ts-ignore`, or `@ts-expect-error`.
- No secrets in source, images, logs, tests, or documentation examples.
- HTTP commands mutate state; Socket.IO emits authorized events after commit.
- PostgreSQL is authoritative; do not add Redis without a measured need.
- Test public behavior at stable seams, not implementation details.
- Update relevant docs and current status whenever a decision or behavior changes.
- Do not commit or push unless the user explicitly requests it.

## Documentation discipline

Keep the root README concise and link to `./docs` for detail. Use an ADR when a decision changes architecture, security, privacy, deployment, or a public contract. Keep roadmap status honest. If a future session cannot understand what is currently happening by reading the documents above, improve the documentation before adding more code.

## Future milestones

Native 1:1 WebRTC video belongs in v1.1, after the v1 stability gate. True end-to-end encryption and provider-neutral AI integrations are later milestones with additional privacy and legal review requirements.
