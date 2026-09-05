# Cookie policy from public origin

**Status:** Accepted

## Context

Mugful serves cookie-authenticated browser sessions. Its public deployment can be reached over a trusted Tailscale or LAN HTTP origin during private operations, while its Internet-facing deployment must use HTTPS. Browsers reject `Secure` cookies over HTTP, and `__Host-` cookie names require `Secure`, so a policy based only on `NODE_ENV` would make valid private HTTP sessions unusable.

## Decision

Derive cookie names and the `Secure` attribute from the scheme of the required `WEB_ORIGIN`.

- An `http:` `WEB_ORIGIN` issues `mugful-session` and `mugful-csrf` without `Secure`.
- An `https:` `WEB_ORIGIN` issues `__Host-mugful-session` and `__Host-mugful-csrf` with `Secure`, `Path=/`, and no `Domain` attribute.
- CSRF cookies use the same 30-day lifetime as persisted sessions. Cookie-authenticated mutations still require the exact public `Origin` and the signed CSRF token.

Plain HTTP is restricted to trusted private-network access and is not an Internet-facing deployment mode.

## Consequences

Private HTTP browser sessions work without weakening the HTTPS cookie policy. Operators must set `WEB_ORIGIN` to the exact scheme, host, and port used by browsers; accessing a stack through a different origin correctly fails origin-protected mutations. Moving to HTTPS changes cookie names, so existing HTTP sessions do not survive the migration and users must sign in again.

## Alternatives

- Always set `Secure` cookies: rejected because browsers do not return them over trusted HTTP.
- Derive the policy from `NODE_ENV`: rejected because production processes can intentionally serve trusted HTTP during private operations.
- Keep plain cookie names for HTTPS: rejected because `__Host-` names add host-only enforcement and make the HTTPS boundary explicit.

## Follow-up

Before an Internet-facing rollout, configure an HTTPS `WEB_ORIGIN`, deploy TLS at the public edge, and verify that response cookies are `__Host-*` and `Secure`. Retain the existing HTTP contract checks only for trusted private-network deployments.
