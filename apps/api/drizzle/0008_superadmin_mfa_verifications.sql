CREATE TABLE superadmin_mfa_verifications (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  method VARCHAR(16) NOT NULL CHECK (method IN ('passkey', 'totp')),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > verified_at),
  CHECK (revoked_at IS NULL OR revoked_at > verified_at)
);

CREATE INDEX superadmin_mfa_verifications_account_lookup
  ON superadmin_mfa_verifications(account_id);
