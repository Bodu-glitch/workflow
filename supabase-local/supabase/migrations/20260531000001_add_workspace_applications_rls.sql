-- Enable RLS so Realtime can evaluate tenant_id filter before sending events
ALTER TABLE workspace_applications ENABLE ROW LEVEL SECURITY;

-- BO and OT can view all pending applications for their tenant (enables realtime filter)
CREATE POLICY "managers_view_tenant_applications" ON workspace_applications
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
        AND role IN ('business_owner', 'operator')
        AND is_active = true
    )
  );

-- Applicants can view their own applications (enables realtime in fe-staff)
CREATE POLICY "applicants_view_own_applications" ON workspace_applications
  FOR SELECT USING (applicant_id = auth.uid());
