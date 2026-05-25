CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

CREATE TABLE workspace_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status application_status NOT NULL DEFAULT 'pending',
  message text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  UNIQUE(applicant_id, tenant_id)
);

CREATE INDEX idx_ws_apps_applicant ON workspace_applications(applicant_id, status);
CREATE INDEX idx_ws_apps_tenant ON workspace_applications(tenant_id, status);
