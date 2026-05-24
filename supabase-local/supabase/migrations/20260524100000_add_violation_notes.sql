-- Add lock_reason to user_tenants
ALTER TABLE user_tenants ADD COLUMN IF NOT EXISTS lock_reason TEXT;

-- Staff violation notes
CREATE TABLE IF NOT EXISTS staff_violation_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_violation_notes_user   ON staff_violation_notes(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_violation_notes_tenant ON staff_violation_notes(tenant_id, created_at DESC);
