# Environment reference

**Status:** Planning reference; exact variable names are finalized with the first Compose configuration.
**Rule:** Never put real values, credentials, private keys, or production environment files in the repository.

This document records the categories of configuration the implementation must expose. The final reference must be generated from the validated configuration schema so documentation and runtime validation cannot drift.

## Configuration categories

| Category          | Examples of responsibility                                        | Secret?                 |
| ----------------- | ----------------------------------------------------------------- | ----------------------- |
| Runtime           | Environment name, log level, public origin                        | Usually no              |
| Database          | PostgreSQL connection and migration settings                      | Yes                     |
| Sessions          | Cookie policy, session lifetime, signing/encryption material      | Yes                     |
| Private content   | Application encryption key reference and rotation metadata        | Yes                     |
| SMTP              | Host, port, TLS mode, sender, provider credentials                | Credentials yes         |
| Feature flags     | Registration mode, maintenance mode, activity availability        | No, but audited         |
| Docker/deployment | Image tags, registry credentials, release selection               | Registry credential yes |
| Observability     | Health endpoint and uptime configuration                          | Usually no              |
| Future providers  | AI or TURN settings only when their roadmap milestone is approved | Yes                     |

## Secret handling

- Local development uses an ignored environment file populated from safe placeholders.
- Mailpit is used locally so development does not send real email.
- Production values live outside the repository in a restricted VPS secret file or an approved secret manager.
- Secrets are never placed in Docker images, committed configuration, logs, screenshots, tests, or documentation examples.
- Rotation procedures must be documented for database credentials, session/encryption keys, SMTP credentials, Docker Hub tokens, and future provider keys.

## Required validation

The application must fail clearly at startup when a required production value is missing or malformed. Optional future integrations must remain disabled unless their complete configuration, consent, legal, and operational prerequisites are present.
