CREATE TABLE superadmin_accounts (
  account_id UUID PRIMARY KEY REFERENCES accounts(id),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CHECK (revoked_at IS NULL OR revoked_at > enrolled_at)
);

CREATE TABLE superadmin_passkey_credentials (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES superadmin_accounts(account_id),
  credential_id VARCHAR(512) NOT NULL UNIQUE CHECK (
    char_length(credential_id) BETWEEN 16 AND 512
    AND credential_id ~ '^[A-Za-z0-9_-]+$'
  ),
  public_key VARCHAR(512) NOT NULL CHECK (
    char_length(public_key) BETWEEN 32 AND 512
    AND public_key ~ '^[A-Za-z0-9_-]+$'
  ),
  sign_count INTEGER NOT NULL DEFAULT 0 CHECK (sign_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK ((last_used_at IS NULL) OR (last_used_at >= created_at)),
  CHECK (revoked_at IS NULL OR revoked_at > created_at)
);

CREATE INDEX superadmin_passkey_credentials_active_account_lookup
  ON superadmin_passkey_credentials(account_id) WHERE revoked_at IS NULL;

CREATE TABLE superadmin_totp_recovery (
  account_id UUID PRIMARY KEY REFERENCES superadmin_accounts(account_id),
  secret VARCHAR(32) NOT NULL CHECK (
    char_length(secret) = 32
    AND secret ~ '^[A-Z2-7]+$'
  ),
  digits INTEGER NOT NULL DEFAULT 6 CHECK (digits IN (6, 8)),
  period_seconds INTEGER NOT NULL DEFAULT 30 CHECK (period_seconds IN (30, 60)),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_step BIGINT NOT NULL DEFAULT 0 CHECK (last_used_step >= 0),
  revoked_at TIMESTAMPTZ,
  CHECK (revoked_at IS NULL OR revoked_at > enrolled_at)
);

CREATE TABLE superadmin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id),
  action VARCHAR(32) NOT NULL CHECK (action IN (
    'granted',
    'revoked',
    'passkey_registered',
    'passkey_revoked',
    'totp_enrolled',
    'totp_revoked',
    'authentication_succeeded',
    'authentication_failed'
  )),
  detail VARCHAR(500),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by_account_id UUID REFERENCES accounts(id)
);

CREATE INDEX superadmin_audit_events_account_lookup
  ON superadmin_audit_events(account_id, changed_at);
