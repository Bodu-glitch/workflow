-- ── Work Shifts (ca làm việc templates per tenant) ───────────────────────────
CREATE TABLE IF NOT EXISTS work_shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Shift Assignments (ai làm ca nào, ngày nào) ───────────────────────────────
CREATE TABLE IF NOT EXISTS shift_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id   UUID NOT NULL REFERENCES work_shifts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_date  DATE NOT NULL,
  note       TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shift_id, user_id, work_date)
);

-- ── Leave Requests (đơn xin nghỉ phép) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'annual'
                  CHECK (type IN ('annual', 'sick', 'personal', 'other')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  reject_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_tenant_date ON shift_assignments(tenant_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_user ON shift_assignments(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id, tenant_id);
