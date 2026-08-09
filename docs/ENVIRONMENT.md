# Environment reference

**Status:** 0b local runtime reference. `.env.example` contains safe placeholders only.
**Rule:** Never put real values, credentials, private keys, or production environment files in the repository.

Zod validates API and server-side web configuration. Invalid values fail with generic errors and never echo connection URLs or credentials.

| Variable                       | Consumer                 | Secret | Rule                                                                         |
| ------------------------------ | ------------------------ | ------ | ---------------------------------------------------------------------------- |
| `POSTGRES_DB`, `POSTGRES_USER` | Compose                  | No     | Required non-empty values                                                    |
| `POSTGRES_PASSWORD`            | Compose                  | Yes    | Required; trust authentication is prohibited                                 |
| `POSTGRES_PORT`                | Compose                  | No     | Defaults to `5432`, bound only to `127.0.0.1`                                |
| `DATABASE_URL`                 | API and manual migration | Yes    | Valid `postgres://` or `postgresql://` URL                                   |
| `API_HOST`, `API_PORT`         | Fastify                  | No     | Defaults to `127.0.0.1:3001`                                                 |
| `API_INTERNAL_ORIGIN`          | Next rewrite             | No     | Required server-only URL without `/api` suffix                               |
| `WEB_ORIGIN`                   | API identity policy      | No     | Required absolute browser origin                                             |
| `REGISTRATION_DEFAULT_ENABLED` | API identity policy      | No     | Optional `true` or `false`; defaults `false`                                 |
| `SESSION_TOKEN_PEPPER`         | API identity policy      | Yes    | Required minimum 32-character secret                                         |
| `CSRF_SECRET`                  | API identity policy      | Yes    | Required minimum 32-character secret                                         |
| `RATE_LIMIT_PRINCIPAL_PEPPER`  | API identity policy      | Yes    | Required HMAC secret; never persist principals                               |
| `IDENTITY_TOKEN_PEPPER`        | API identity tokens      | Yes    | Required HMAC secret; only token hashes persist                              |
| `SMTP_HOST`                    | API SMTP mailer          | No     | Required SMTP hostname; Mailpit is `127.0.0.1` locally                       |
| `SMTP_PORT`                    | API SMTP mailer          | No     | Required SMTP port; Mailpit defaults to `1025`                               |
| `SMTP_SECURE`                  | API SMTP mailer          | No     | Required `true` for implicit TLS or `false` for STARTTLS/plain local Mailpit |
| `SMTP_FROM`                    | API SMTP mailer          | No     | Required approved sender address or display-address value                    |
| `SMTP_USER`, `SMTP_PASS`       | API SMTP mailer          | Yes    | Optional together; omit both for local Mailpit                               |

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
- Mailpit is used only locally and in isolated integration runtimes so development does not send real email.
- The API validates SMTP configuration at startup but never logs the SMTP URL, credentials, message body, or identity tokens.
- Production values live outside the repository in a restricted VPS secret file or an approved secret manager.
- Secrets are never placed in Docker images, committed configuration, logs, screenshots, tests, or documentation examples.
- Rotation procedures must be documented for database credentials, session/encryption keys, SMTP credentials, Docker Hub tokens, and future provider keys.

## Required validation

The application must fail clearly at startup when a required production value is missing or malformed. Optional future integrations must remain disabled unless their complete configuration, consent, legal, and operational prerequisites are present.
