# External services runbook index

Every external service must have a setup path that a new contributor can follow without private context. The detailed runbook for a service should cover:

1. Why the service exists.
2. Whether it is required, optional, development-only, or future-only.
3. Account and domain setup.
4. DNS records and verification.
5. Environment variables and secret creation.
6. Local/test verification.
7. Production health checks.
8. Limits, cost, and data sent.
9. Key rotation and failure handling.
10. Removal or provider migration.

## Current service matrix

| Service                   | Status                                                            | Documentation                                            |
| ------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| PostgreSQL 17             | Local-only Compose dependency for the 0b runtime boundary         | [`DEVELOPMENT.md`](./DEVELOPMENT.md)                     |
| Mailpit                   | Local/test SMTP capture only; loopback Compose ports              | [`SMTP-OPTIONS-RESEARCH.md`](./SMTP-OPTIONS-RESEARCH.md) |
| Resend                    | First production SMTP candidate; cross-border treatment may apply | [`SMTP-OPTIONS-RESEARCH.md`](./SMTP-OPTIONS-RESEARCH.md) |
| Brevo                     | Production SMTP alternative                                       | [`SMTP-OPTIONS-RESEARCH.md`](./SMTP-OPTIONS-RESEARCH.md) |
| Docker Hub                | Public web/API image registry                                     | Architecture and deployment docs                         |
| Traefik                   | User-managed VPS routing/TLS                                      | Deployment documentation to be added with Compose        |
| Uptime monitor            | Optional operational monitoring                                   | Must receive only a public health result                 |
| OpenAI, Anthropic, Gemini | Future-only AI providers                                          | Must not be configured for v1                            |
| coturn                    | Future-only v1.1 video dependency                                 | Must not be configured for v1                            |

## Provider-neutral configuration

Application code should depend on interfaces and environment configuration, not provider-specific logic. SMTP configuration is the first example: local Mailpit and production Resend must use the same mailer boundary.

## Setup documentation rule

When an external service is added, update this index, the README, the deployment guide, the environment-variable reference (created with the first Compose configuration), the privacy/data-processing inventory, and the relevant operational tests in the same change. For any production SMTP provider outside Indonesia, document the UU PDP Pasal 56 cross-border safeguards and counsel-reviewed processor treatment before sending user email.
