CREATE TABLE IF NOT EXISTS tenant_services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT tenant_services_unique UNIQUE (tenant_id, name)
);

-- Backfill from existing tasks so old data isn't orphaned
INSERT INTO tenant_services (tenant_id, name)
SELECT DISTINCT tenant_id, service_type
FROM tasks
WHERE service_type IS NOT NULL AND service_type != ''
ON CONFLICT DO NOTHING;