CREATE TABLE rounds (
  id UUID PRIMARY KEY,
  couple_space_id UUID NOT NULL REFERENCES couple_spaces(id),
  prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id),
  status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'waiting-for-partner',
    'ready-to-reveal',
    'revealed',
    'completed',
    'cancelled'
  )),
  created_by_account_id UUID NOT NULL REFERENCES accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancelled_by_account_id UUID REFERENCES accounts(id),
  revealed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CHECK ((cancelled_at IS NULL) = (cancelled_by_account_id IS NULL)),
  CHECK (revealed_at IS NULL OR completed_at IS NOT NULL),
  CHECK (completed_at IS NULL OR revealed_at IS NOT NULL)
);

CREATE UNIQUE INDEX rounds_one_pending_per_space
  ON rounds(couple_space_id)
  WHERE status IN ('active', 'waiting-for-partner', 'ready-to-reveal');

CREATE INDEX rounds_space_history
  ON rounds(couple_space_id, created_at DESC);

CREATE TABLE round_answers (
  round_id UUID NOT NULL REFERENCES rounds(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  answer VARCHAR(1000) NOT NULL CHECK (btrim(answer) <> '' AND answer = btrim(answer)),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (round_id, account_id)
);

CREATE TABLE round_reactions (
  round_id UUID NOT NULL REFERENCES rounds(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  reaction VARCHAR(32) NOT NULL CHECK (btrim(reaction) <> '' AND reaction = btrim(reaction)),
  reacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (round_id, account_id)
);
