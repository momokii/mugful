CREATE TABLE prompts (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_account_id UUID REFERENCES accounts(id)
);

CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY,
  prompt_id UUID NOT NULL REFERENCES prompts(id),
  version INTEGER NOT NULL CHECK (version >= 1),
  text VARCHAR(500) NOT NULL CHECK (btrim(text) <> '' AND text = btrim(text)),
  category VARCHAR(64) NOT NULL CHECK (
    btrim(category) <> '' AND category = btrim(category)
  ),
  status VARCHAR(8) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_account_id UUID REFERENCES accounts(id),
  retired_at TIMESTAMPTZ,
  UNIQUE (prompt_id, version),
  CHECK ((status = 'active') = (retired_at IS NULL))
);

CREATE UNIQUE INDEX prompt_versions_one_active_per_prompt
  ON prompt_versions(prompt_id) WHERE status = 'active';

CREATE TABLE prompt_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  prompt_id UUID NOT NULL REFERENCES prompts(id),
  action VARCHAR(16) NOT NULL CHECK (action IN ('created', 'updated', 'retired')),
  previous_version INTEGER,
  next_version INTEGER NOT NULL CHECK (next_version >= 1),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by_account_id UUID REFERENCES accounts(id),
  reason VARCHAR(500),
  CHECK (
    (action = 'created' AND previous_version IS NULL)
    OR (
      action = 'updated'
      AND previous_version IS NOT NULL
      AND previous_version <> next_version
    )
    OR (
      action = 'retired'
      AND previous_version IS NOT NULL
      AND previous_version = next_version
    )
  )
);

CREATE INDEX prompt_audit_events_prompt_lookup
  ON prompt_audit_events(prompt_id, changed_at);
