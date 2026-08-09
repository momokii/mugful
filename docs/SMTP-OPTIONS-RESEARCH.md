# SMTP Options for a Small TypeScript Web App

> **Research date**: 2026-08-08
> **Stack context**: Next.js + Fastify + PostgreSQL on Docker Compose behind Traefik, email/password auth with verification + password reset, optional couple-invitation email, low volume, personal VPS.
> **Disclaimer**: Pricing, free-tier limits, and product names change frequently. Every claim below links to its official source. Re-verify on the provider's pricing page before committing to a choice. This document is research/notes only — it does not modify any repository file.

---

## TL;DR — Recommended starting approach

| Environment                               | What to use                                                           | Why                                                                                                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local development**                     | **Mailpit** (Docker container)                                        | Free, fast, zero external dependencies, captures & previews every message, real SMTP port 1025 + web UI on 8025.                                                                                                |
| **Production (personal VPS, low volume)** | **Resend Free** _or_ **Brevo Starter** _or_ **Amazon SES Essentials** | All expose standard SMTP (port 587 STARTTLS) and support custom domain authentication. Resend has the cleanest DX; Brevo has the most generous free email volume; SES is the cheapest per message at any scale. |
| **If you already use Google Workspace**   | **Google Workspace SMTP Relay** (`smtp-relay.gmail.com` port 587)     | IP- or SMTP-AUTH-authenticated relay, designed for app sending, supports up to 10,000 recipients/day.                                                                                                           |
| **Do not use**                            | Personal `@gmail.com` SMTP for production app sending                 | 500 emails/day cap, "less secure apps" blocked, no domain identity, deliverability will hurt.                                                                                                                   |

**Provider-neutral pattern**: keep all SMTP config in environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`). In dev, point to Mailpit. In prod, point to whichever provider above. This way swapping providers is a config change, not a code change.

---

## 1. Mailpit — local development

**Official site / docs**: <https://mailpit.axllent.org/docs/>
**GitHub**: <https://github.com/axllent/mailpit>

What Mailpit actually is, per the official docs ([mailpit.axllent.org/docs](https://mailpit.axllent.org/docs/)):

- A "small, fast, low memory, zero-dependency, multi-platform email testing tool & API for developers." Runs as a single static binary or multi-arch Docker image.
- Acts as an SMTP server (default port **1025**) and provides a modern web UI (default port **8025**) to inspect captured messages.
- Supports SMTP authentication (PLAIN / LOGIN) and optional STARTTLS or SSL/TLS, but by default listens unencrypted with no auth — fine for local dev.
- Provides a REST API for automated integration tests, plus a "chaos" feature to inject SMTP errors for resilience testing.
- Default retention: 500 most recent messages, auto-pruned.
- Ingestion rate: 100–200 emails/second depending on hardware.

> Source: <https://mailpit.axllent.org/docs/> and <https://mailpit.axllent.org/docs/configuration/smtp/>

**Why it's the right default for local dev**:

- Your app's SMTP env vars point to `localhost:1025` (or the Docker service name) — no real delivery, no risk of accidentally emailing real users during development.
- The web UI at `http://localhost:8025` lets you click every verification / reset / invite email to verify HTML, links, and copy.
- Zero external service dependency — works offline, no API key needed.

**Docker Compose example shape** (conceptual — do not commit yet, this is just for understanding):

```yaml
services:
  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025" # SMTP
      - "8025:8025" # Web UI
```

---

## 2. Gmail personal SMTP — NOT recommended for production

**Official source**: <https://support.google.com/mail/answer/22839>

- Personal Gmail accounts (`@gmail.com`, `@googlemail.com`) are limited to **500 emails per day** ([support.google.com/mail/answer/22839](https://support.google.com/mail/answer/22839)).
- Maximum **500 recipients per single message**; exceeding either limit triggers a temporary block with the error: _"Daily user sending limit exceeded"_ ([support.google.com/mail/answer/3726730](https://support.google.com/mail/answer/3726730)).
- Authentication via app password requires **2-Step Verification** to be enabled ([support.google.com/mail/answer/185833](https://support.google.com/mail/answer/185833)).
- The From: address is always your Gmail address — you cannot send as your own domain without an alias + DKIM setup, and personal Gmail is not a transactional sender.
- Google's own docs say: _"To help prevent spam and keep accounts safe, Gmail limits the number of emails you can send or get per day."_ Source: <https://support.google.com/mail/answer/22839>

**Verdict**: Suitable for quick personal experiments. Not suitable for a production app where password-reset and verification emails need to reliably reach users and look like they come from your product. Use Google Workspace SMTP Relay (next section) or a transactional provider instead.

---

## 3. Google Workspace SMTP Relay (smtp-relay.gmail.com) — for Google Workspace users

**Official source**: <https://support.google.com/a/answer/2956491> and <https://support.google.com/a/answer/176600>

This is the correct Google option for sending app/system email and is **distinct from personal Gmail SMTP**:

|                             | Personal Gmail SMTP         | Google Workspace SMTP Relay                                                                                           |
| --------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Host                        | `smtp.gmail.com`            | `smtp-relay.gmail.com`                                                                                                |
| Auth                        | App password (2FA required) | IP allowlist **or** SMTP AUTH with Workspace creds                                                                    |
| TLS                         | Required for SMTP AUTH      | Optional; required if using SMTP AUTH                                                                                 |
| Daily limit                 | 500/day per user            | **10,000 recipients/day per user** ([support.google.com/a/answer/176600](https://support.google.com/a/answer/176600)) |
| From: address               | Your `@gmail.com` only      | Any address in your verified Workspace domain                                                                         |
| Recommended for app sending | No                          | Yes                                                                                                                   |

> Source for the 10,000-recipient-per-day relay limit: <https://support.google.com/a/answer/176600> — _"Each user in your organization can relay messages up to 10,000 recipients per day."_

**Setup** (per [support.google.com/a/answer/2956491](https://support.google.com/a/answer/2956491)):

1. Admin console → Apps → Google Workspace → Gmail → Routing → SMTP relay service → Configure.
2. Choose allowed senders (typically: "Only registered Apps users in my domains").
3. Choose authentication: **IP allowlist** (recommended for static-server deployments) **or** **SMTP Authentication** (requires TLS).
4. Optionally require TLS.
5. Point your app to `smtp-relay.gmail.com` on port 25, 465, or 587 (587 + STARTTLS is the modern choice).

**Suitability for this app**: Excellent _if you already pay for Google Workspace_. Not the right choice for a brand-new free-tier user — a transactional email provider is simpler.

---

## 4. Transactional email providers with standard SMTP (as of 2026-08-08)

All providers below expose **standard SMTP on port 587 (STARTTLS) or 465 (SMTPS)** in addition to their HTTP API. Authentication is `PLAIN`/`LOGIN` with an API key as username and the API key (or a derived SMTP password) as password.

### 4.1 Resend

|                 |                                                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free tier       | **3,000 emails/month, 100 emails/day** ([resend.com/pricing](https://resend.com/pricing), [resend.com/docs/knowledge-base/account-quotas-and-limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)) |
| Paid starts     | $20/mo for 50,000 emails                                                                                                                                                                                                |
| Domains on free | 1 verified domain                                                                                                                                                                                                       |
| Authentication  | API key; SMTP relay supported on all plans ([resend.com/docs/send-with-smtp](https://resend.com/docs/send-with-smtp))                                                                                                   |
| Standard SMTP   | Yes — explicit SMTP relay offered                                                                                                                                                                                       |
| Notes           | Daily cap of 100 is the most common free-tier gotcha; sender reputation built on shared IPs                                                                                                                             |

> Sources: <https://resend.com/pricing>, <https://resend.com/docs/knowledge-base/account-quotas-and-limits>, <https://resend.com/blog/new-free-tier>

### 4.2 Brevo (formerly Sendinblue)

|                                |                                                                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free tier                      | **Up to 300 emails/day** on the free plan after account approval ([brevo.com/pricing](https://www.brevo.com/pricing/)) — "Once we approve your account for sending, you can start sending up to 300 emails per day." |
| Monthly emails on paid Starter | "From 5,000 emails per month" (Starter is free forever with daily cap; paid plans add more volume and remove the cap)                                                                                                |
| Authentication                 | SMTP credentials (login + SMTP key) in account settings                                                                                                                                                              |
| Standard SMTP                  | Yes — Brevo has a dedicated "SMTP relay" product ([brevo.com/products/transactional-email](https://www.brevo.com/products/transactional-email/))                                                                     |
| Notes                          | "No Brevo logo" footer removed on paid plans; transactional email is supported on all plans including free                                                                                                           |

> Source: <https://www.brevo.com/pricing/> — "When you create an account, you will automatically have a Free plan... Once we approve your account for sending, you can start sending up to 300 emails per day." Also: <https://www.brevo.com/products/transactional-email/>

### 4.3 Mailgun

|                |                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free tier      | **100 emails/day** for $0/mo, with 1 custom sending domain, 1-day log retention, 1 inbound route, ticket support ([mailgun.com/pricing](https://www.mailgun.com/pricing/)) |
| Paid starts    | Basic $15/mo for 10,000 emails                                                                                                                                             |
| Authentication | API key; SMTP credentials created in the dashboard                                                                                                                         |
| Standard SMTP  | Yes — "RESTful email APIs and SMTP relay" listed in the Free plan                                                                                                          |
| Notes          | Slightly more developer-oriented; account signup is fast and credit-card-free for the free tier                                                                            |

> Source: <https://www.mailgun.com/pricing/>

### 4.4 Postmark

|                |                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Free tier      | **100 emails/month** on the Developer plan, no expiration ([postmark.com/pricing](https://postmarkapp.com/pricing)) |
| Paid starts    | Basic $15/mo for 10,000 emails                                                                                      |
| Authentication | Server token used as SMTP password                                                                                  |
| Standard SMTP  | Yes — "Up to 10 servers" and SMTP listed across all tiers                                                           |
| Notes          | Strong deliverability reputation; transactional-only (no marketing) by design                                       |

> Source: <https://postmarkapp.com/pricing>

### 4.5 Amazon SES

|                            |                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free tier                  | AWS Free Tier credits apply ($200 in credits for new AWS accounts); SES itself is **pay-as-you-go with no free monthly volume by default**                                                                                                                          |
| Pricing                    | **Essentials**: $0.10 / 1,000 outbound emails (à la carte) up to 10M/mo; Pro $0.22/1k + $105/mo fixed; Enterprise $0.23/1k + $500/mo fixed ([aws.amazon.com/ses/pricing](https://aws.amazon.com/ses/pricing/))                                                      |
| Authentication             | SMTP credentials (generated from IAM in SES console; password is _derived_ from your AWS secret access key, not the access key itself) ([docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html)) |
| Standard SMTP              | Yes — endpoint per region (e.g. `email-smtp.us-east-1.amazonaws.com` on 587)                                                                                                                                                                                        |
| Sender/domain verification | Required: verify each domain or email address before sending; production access requires moving out of the SES sandbox                                                                                                                                              |
| Notes                      | **Cheapest at scale** (pennies per thousand); requires AWS account + region setup; sandbox mode initially only allows sending to verified addresses                                                                                                                 |

> Sources: <https://aws.amazon.com/ses/pricing/>, <https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html>

### 4.6 Twilio SendGrid (Email API)

|                |                                                                                                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free tier      | **Free trial: 100 emails/day for 60 days** (then a paid Essentials plan at **$19.95/mo** is the entry tier) ([twilio.com/en-us/products/email-api/pricing](https://www.twilio.com/en-us/products/email-api/pricing)) |
| Paid tiers     | Essentials from $19.95/mo, Pro from $89.95/mo, Premier custom                                                                                                                                                        |
| Authentication | API key; SMTP username + password separate in the dashboard                                                                                                                                                          |
| Standard SMTP  | Yes — dedicated SMTP service product                                                                                                                                                                                 |
| Notes          | Historically the market leader; free trial is time-limited, not permanent. Note SendGrid branding has merged into Twilio.com                                                                                         |

> Source: <https://www.twilio.com/en-us/products/email-api/pricing>

### 4.7 Zoho ZeptoMail

|                |                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Free tier      | **First credit free = 10,000 transactional emails** as a one-time trial credit (zoho.com/zeptomail/pricing) |
| Paid model     | Pay-as-you-go in credits: 1 credit = 10,000 emails; credits valid 6 months; no monthly minimum              |
| Authentication | SMTP / API; transactional-only by design                                                                    |
| Standard SMTP  | Yes — "SMTP is a simple configuration method" per their docs                                                |
| Notes          | Tight scope (transactional only); good if you specifically want Zoho as vendor                              |

> Source: <https://www.zoho.com/zeptomail/pricing.html>

---

## 5. Comparison table

| Provider                        | Free?                  | Free limit                  | Paid start                         | Standard SMTP               | Custom domain         | Best for                  |
| ------------------------------- | ---------------------- | --------------------------- | ---------------------------------- | --------------------------- | --------------------- | ------------------------- |
| **Mailpit**                     | Yes (self-host)        | Unlimited local capture     | N/A                                | ✅ (port 1025)              | n/a                   | Local dev only            |
| **Gmail personal**              | Yes                    | 500/day                     | n/a                                | ✅ (`smtp.gmail.com`)       | ❌ From = @gmail.com  | Experiments only          |
| **Google Workspace SMTP Relay** | With Workspace sub     | n/a                         | $7+/user/mo                        | ✅ (`smtp-relay.gmail.com`) | ✅ any in domain      | Existing Workspace users  |
| **Resend**                      | ✅                     | 3,000/mo, 100/day           | $20/mo                             | ✅ SMTP relay               | ✅ 1 domain free      | Cleanest DX, modern stack |
| **Brevo**                       | ✅                     | 300/day after approval      | Free tier extends; paid for volume | ✅ SMTP relay               | ✅                    | Generous free daily cap   |
| **Mailgun**                     | ✅                     | 100/day                     | $15/mo                             | ✅ SMTP relay               | ✅ 1 domain free      | Devs, traditional SMTP    |
| **Postmark**                    | ✅                     | 100/mo (no expiry)          | $15/mo                             | ✅ SMTP                     | ✅ transactional only | Deliverability purist     |
| **Amazon SES**                  | ⚠️ AWS credits only    | Pay-as-you-go from $0.10/1k | Pay-as-you-go                      | ✅ SMTP per region          | ✅ verified           | Lowest cost at scale      |
| **SendGrid**                    | ⚠️ 60-day trial        | 100/day × 60 days           | $19.95/mo                          | ✅ SMTP service             | ✅                    | Trial users, mature stack |
| **Zoho ZeptoMail**              | ⚠️ one-time 10k credit | One-time                    | Pay-as-you-go                      | ✅ SMTP                     | ✅                    | Transactional-only purist |

> All "Free" rows must be reverified on the provider's current pricing page before any real commitment.

---

## 6. Provider-neutral SMTP configuration (environment variables)

The goal: zero code change when moving from local Mailpit to a production provider. Use environment variables — never hardcode.

```
SMTP_HOST=          # e.g. localhost (dev) | smtp-relay.gmail.com | email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587       # 587 for STARTTLS, 465 for SMTPS, 1025 for Mailpit plain
SMTP_SECURE=false   # true for port 465 (implicit TLS), false for STARTTLS on 587
SMTP_USER=          # blank for Mailpit accept-any; provider username otherwise
SMTP_PASS=          # blank for Mailpit accept-any; app password / API key otherwise
SMTP_FROM="My App <noreply@yourdomain.com>"
SMTP_FROM_NAME=
SMTP_REPLY_TO=
```

In a Node.js / TypeScript app, **Nodemailer** is the standard SMTP client. SMTP transport config pattern (conceptual, not committed):

```ts
import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true", // true for 465
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
  // Most providers also need TLS opts; do not disable cert verification in prod
});
```

**Local dev** (`docker-compose.yml` env):

```
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_SECURE=false
# no auth — Mailpit accept-any
SMTP_FROM="My App <dev@localhost>"
```

**Production** env (per provider):

- **Resend**: `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASS=<api-key>` (see [resend.com/docs/send-with-smtp](https://resend.com/docs/send-with-smtp))
- **Brevo**: `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER=<account-email>`, `SMTP_PASS=<smtp-key>`
- **Mailgun**: `SMTP_HOST=smtp.mailgun.org`, `SMTP_PORT=587`, `SMTP_USER=postmaster@<your-domain>`, `SMTP_PASS=<smtp-password>`
- **Postmark**: `SMTP_HOST=smtp.postmarkapp.com`, `SMTP_PORT=587`, `SMTP_USER=<server-token>`, `SMTP_PASS=<server-token>`
- **Amazon SES**: `SMTP_HOST=email-smtp.<region>.amazonaws.com`, `SMTP_PORT=587`, `SMTP_USER=<smtp-username>`, `SMTP_PASS=<smtp-password>` (see [docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html))
- **Google Workspace SMTP Relay**: `SMTP_HOST=smtp-relay.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=<workspace-email>`, `SMTP_PASS=<app-password>` (only if using SMTP AUTH; otherwise use IP allowlist with no auth)

> **Note on secrets**: The above snippet is illustrative only. Actual implementation, secret management, and the `.env.example` / deployment configuration should be done in the repository when the work to add email sending begins — not as part of this research note. The original task explicitly stated _"Do not modify repository files."_

---

## 7. Secret handling and deliverability essentials

### Secrets

- **Never** commit SMTP credentials to git. Use `.env` for local dev (gitignored) and a real secret store for the VPS — for a personal VPS, even `pass`, an encrypted `.env` file outside the repo, or the platform's secret manager is fine. The point is: secrets should not live in the image.
- Use **app passwords / API keys scoped to sending only**, not your master account password.
- Rotate keys when an employee or device leaves your trust boundary.

### Deliverability (what makes emails land in Inbox, not Spam)

- **SPF**: publish a TXT record at your domain authorizing the provider's SMTP servers to send on your behalf. Each provider publishes the exact record in their setup docs.
- **DKIM**: each provider also issues you a DKIM CNAME; publish it. This is what signs your messages cryptographically.
- **DMARC**: start with a `p=none` policy and a reporting URI (`rua=mailto:...`) to monitor, then tighten to `p=quarantine` or `p=reject` once you trust the setup.
- **Custom return-path / MAIL FROM**: many providers let you set a subdomain (e.g. `bounce.yourdomain.com`) as the envelope sender. Configure this for cleaner bounce handling.
- **Reverse DNS (PTR)**: providers handle this on their shared IPs; if you ever get a dedicated IP, you'll need to set the PTR record.
- **Warm up new IPs / domains**: low-volume senders on shared IPs do not need to do this; high-volume senders on dedicated IPs do.

> SPF/DKIM/DMARC are referenced as required by every provider above (Resend, Brevo, Mailgun, Postmark, SES, SendGrid all surface them in their setup flow).

### Account security

- **Do not store passwords in plaintext** anywhere in the app or database. Use a memory-hard KDF (Argon2id, scrypt, or bcrypt with a high cost) for user login passwords; use a **single-use, time-limited, cryptographically random token** (e.g. 32 bytes from `crypto.randomBytes`) for password-reset and email-verification links. This is a precondition for shipping any of this, and is deliberately out of scope for an SMTP-options research note — but is called out so the next implementation step does not skip it.

---

## 8. Recommendation for this specific app

Given:

- Personal VPS on Docker Compose behind Traefik
- Low volume (couple app, maybe dozens of users at most)
- User wants "simple free/low-cost starting option" and is not familiar with SMTP
- Auth flows that _must_ reliably deliver (password reset, verification)

**Suggested staged plan**:

1. **Local dev (now)**: Mailpit via Docker. One env-var switch, no real email leaves the dev box.
2. **First production deploy**: **Resend Free** (3,000/mo, 100/day) — cleanest DX, modern docs, no credit card required, and the 100/day cap is fine for early adoption. Add the domain, set up SPF/DKIM/DMARC per their docs.
3. **If 100/day is too tight** (e.g. an invite wave): **Brevo** (300/day) or jump to **Resend Pro** ($20/mo) or **SES à-la-carte** ($0.10/1k).
4. **If you later add Google Workspace** for other reasons: switch the same env-var-driven config to `smtp-relay.gmail.com`.

Avoid personal Gmail SMTP for production. Avoid Mailgun/Postmark/SendGrid if you're new — they work, but the onboarding is heavier than Resend or Brevo.

---

## 9. Verify before relying on this

This document was assembled on **2026-08-08** from the official pricing and documentation pages linked throughout. Pricing, free-tier limits, and even product names do change (Brevo was Sendinblue; Resend's free tier was raised from 100/mo to 3,000/mo in 2023; SES restructured into plans in 2025–2026). Before locking in a choice for production:

- Open the provider's current pricing page.
- Open the provider's SMTP setup doc and confirm the host/port/auth method is unchanged.
- Re-check the free tier's daily _and_ monthly cap.

Primary sources cited in this document (all official, all accessed 2026-08-08):

- Mailpit — <https://mailpit.axllent.org/docs/>, <https://github.com/axllent/mailpit>
- Gmail personal limits — <https://support.google.com/mail/answer/22839>, <https://support.google.com/mail/answer/185833>
- Google Workspace SMTP Relay — <https://support.google.com/a/answer/2956491>, <https://support.google.com/a/answer/176600>
- Resend — <https://resend.com/pricing>, <https://resend.com/docs/knowledge-base/account-quotas-and-limits>, <https://resend.com/docs/send-with-smtp>
- Brevo — <https://www.brevo.com/pricing/>, <https://www.brevo.com/products/transactional-email/>
- Mailgun — <https://www.mailgun.com/pricing/>
- Postmark — <https://postmarkapp.com/pricing>
- Amazon SES — <https://aws.amazon.com/ses/pricing/>, <https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html>
- SendGrid — <https://www.twilio.com/en-us/products/email-api/pricing>
- Zoho ZeptoMail — <https://www.zoho.com/zeptomail/pricing.html>
