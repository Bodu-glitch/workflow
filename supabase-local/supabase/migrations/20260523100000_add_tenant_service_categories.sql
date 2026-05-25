-- Junction table: which service categories a tenant offers
-- Separate from service_pricings (pricing detail) — this is a simple on/off toggle
CREATE TABLE tenant_service_categories (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, category_id)
);

CREATE INDEX idx_tenant_service_categories_tenant  ON tenant_service_categories(tenant_id);
CREATE INDEX idx_tenant_service_categories_category ON tenant_service_categories(category_id);
