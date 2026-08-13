CREATE TABLE couple_spaces (
  id UUID PRIMARY KEY,
  created_by_account_id UUID NOT NULL REFERENCES accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by_account_id UUID REFERENCES accounts(id),
  deletion_grace_ends_at TIMESTAMPTZ,
  CHECK (
    (ended_at IS NULL AND ended_by_account_id IS NULL AND deletion_grace_ends_at IS NULL)
    OR (ended_at IS NOT NULL AND ended_by_account_id IS NOT NULL AND deletion_grace_ends_at IS NOT NULL)
  )
);

CREATE TABLE couple_memberships (
  couple_space_id UUID NOT NULL REFERENCES couple_spaces(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (couple_space_id, account_id)
);

CREATE UNIQUE INDEX couple_memberships_one_active_space_per_account
  ON couple_memberships(account_id) WHERE revoked_at IS NULL;

CREATE TABLE couple_invites (
  id UUID PRIMARY KEY,
  couple_space_id UUID NOT NULL REFERENCES couple_spaces(id),
  created_by_account_id UUID NOT NULL REFERENCES accounts(id),
  token_hash CHAR(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by_account_id UUID REFERENCES accounts(id),
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  CHECK ((consumed_at IS NULL) = (consumed_by_account_id IS NULL)),
  CHECK (consumed_at IS NULL OR revoked_at IS NULL)
);

CREATE INDEX couple_invites_active_space_lookup
  ON couple_invites(couple_space_id) WHERE consumed_at IS NULL AND revoked_at IS NULL;
