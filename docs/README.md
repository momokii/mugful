# Documentation index

This directory is the detailed source of truth for product, architecture, operations, privacy, and future work. Keep documents short enough to maintain and link rather than duplicate information.

## Recommended reading order

1. [`PRODUCT-SPEC.md`](./PRODUCT-SPEC.md) — what v1 must do and must not do.
2. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — how the system is shaped.
3. [`CURRENT-STATUS.md`](./CURRENT-STATUS.md) — what is done and what is next.
4. [`DEVELOPMENT.md`](./DEVELOPMENT.md) — fresh-session handoff and development workflow.
5. [`ROADMAP.md`](./ROADMAP.md) — release gate and future milestones.
6. Root [`DESIGN.md`](../DESIGN.md) — UI design tokens before frontend work.
7. [`EXTERNAL-SERVICES.md`](./EXTERNAL-SERVICES.md) — setup and operational dependencies.
8. [`ENVIRONMENT.md`](./ENVIRONMENT.md) — environment-variable categories and secret-handling rules.
9. [`INDONESIA-PDP-COMPLIANCE-CHECKLIST.md`](./INDONESIA-PDP-COMPLIANCE-CHECKLIST.md) — Indonesia privacy research.
10. [`SMTP-OPTIONS-RESEARCH.md`](./SMTP-OPTIONS-RESEARCH.md) — current SMTP options and setup research.
11. [`decisions/README.md`](./decisions/README.md) — ADR format for future architectural changes.
12. [`NAMING-RESEARCH.md`](./NAMING-RESEARCH.md) — naming research and adoption checks for Mugful.

## Document conventions

- Product behavior belongs in the product specification.
- System boundaries and cross-cutting technical decisions belong in architecture.
- A decision that changes a settled tradeoff should receive an ADR under `docs/decisions/`.
- Current progress and release gates belong in the roadmap.
- Provider-specific setup belongs in an external-service runbook, not in application code comments.
- Legal research is labeled as research and not legal advice; counsel-needed items must remain visible.

## Current status

The product and architecture are confirmed, with the local runtime foundation, Todo 4 shell, Todo 5A-5E identity checkpoints, and the Todo 5F consent/privacy identity foundation implemented. Todo 5 remains in progress until independent final review. See [`CURRENT-STATUS.md`](./CURRENT-STATUS.md) for the maintained status snapshot. Existing research notes should be re-verified before a production launch because law, provider limits, and service interfaces can change.
