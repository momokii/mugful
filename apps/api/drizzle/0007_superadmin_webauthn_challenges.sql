CREATE TABLE superadmin_webauthn_challenges (
  challenge VARCHAR(128) PRIMARY KEY CHECK (
    char_length(challenge) BETWEEN 16 AND 128
    AND challenge ~ '^[A-Za-z0-9_-]+$'
  ),
  purpose VARCHAR(16) NOT NULL CHECK (purpose IN ('registration', 'authentication')),
  account_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);

CREATE INDEX superadmin_webauthn_challenges_account_purpose_lookup
  ON superadmin_webauthn_challenges(account_id, purpose);

CREATE INDEX superadmin_webauthn_challenges_expiry
  ON superadmin_webauthn_challenges(expires_at);
