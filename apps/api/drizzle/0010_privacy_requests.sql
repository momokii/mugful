CREATE TABLE privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  kind VARCHAR(32) NOT NULL CHECK (kind IN ('export','correction','deletion','withdrawal','restriction')),
  status VARCHAR(32) NOT NULL DEFAULT 'completed' CHECK (status IN ('requested','completed')),
  payload JSONB,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (resolved_at >= requested_at)
);

CREATE INDEX privacy_requests_account_kind ON privacy_requests(account_id, kind, requested_at DESC);

CREATE TABLE account_processing_restrictions (
  account_id UUID PRIMARY KEY REFERENCES accounts(id),
  restricted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason VARCHAR(500),
  lifted_at TIMESTAMPTZ,
  CHECK (lifted_at IS NULL OR lifted_at > restricted_at)
);

ALTER TABLE accounts ADD COLUMN deletion_requested_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN deletion_grace_ends_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN withdrawal_requested_at TIMESTAMPTZ;
ALTER TABLE accounts ADD CHECK (
  (deletion_requested_at IS NULL) = (deletion_grace_ends_at IS NULL)
);
ALTER TABLE accounts ADD CHECK (
  deletion_grace_ends_at IS NULL OR deletion_grace_ends_at > deletion_requested_at
);
