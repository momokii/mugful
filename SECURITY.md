# Security policy

## Status

This project is pre-implementation and not yet suitable for production personal data. Do not use this repository as a live service until the v1 stability gate is complete.

## Reporting a vulnerability

Please use a **private GitHub Security Advisory** rather than opening a public issue for an undisclosed vulnerability. Include:

- affected version or commit;
- a clear description and impact;
- reproducible steps or a minimal proof of concept;
- any required configuration;
- a suggested mitigation, if known.

Do not include real user data, credentials, private keys, or unredacted logs in a report.

## Security boundaries

- Private couple content must never be exposed through superadmin routes or logs.
- Passwords, sessions, invite tokens, reset tokens, SMTP credentials, and encryption keys must never be logged or committed.
- Camera/video recording is not part of v1.
- AI providers are not enabled in v1.
- Security and privacy claims must match the documented v1 application-level boundary; v1 is not end-to-end encrypted.

## Supported versions

The supported-version policy will be published with the first runnable release. Until then, security fixes should target the current development branch and be documented in the release notes.
