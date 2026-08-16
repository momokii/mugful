# Contributing

The project is in active implementation. The product, architecture, design, and current-status documents remain the source of truth for behavior and engineering boundaries.

## Before contributing

Read:

1. `README.md`.
2. `CLAUDE.md`.
3. `docs/PRODUCT-SPEC.md`.
4. `docs/ARCHITECTURE.md`.
5. `DESIGN.md` for frontend work.

## Contribution expectations

- Preserve the v1 scope and privacy boundary.
- Add behavior tests at public seams.
- Do not add a second activity, AI, analytics, Redis, video, or E2EE without updating the roadmap and an ADR.
- Never commit secrets, real couple content, production logs, or generated credentials.
- Update documentation when behavior, configuration, security, or deployment changes.
- Keep user-facing copy clear, accessible, and free from generic placeholder language.

## Pull requests

Every pull request should explain the user-visible behavior, tests run, security/privacy impact, documentation updates, and any operational or migration considerations. CI must pass before merge.

## License

By contributing, you agree that your contribution is provided under the project’s Apache-2.0 license.
