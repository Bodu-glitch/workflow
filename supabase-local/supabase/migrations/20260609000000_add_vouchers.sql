-- ============================================================
-- vouchers
-- ============================================================
CREATE TYPE voucher_type AS ENUM ('percentage', 'fixed');

CREATE TABLE vouchers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  type              voucher_type NOT NULL DEFAULT 'fixed',
  value             NUMERIC(12,2) NOT NULL,
  min_order_amount  NUMERIC(12,2),
  max_discount      NUMERIC(12,2),
  usage_limit       INTEGER,
  used_count        INTEGER NOT NULL DEFAULT 0,
  start_date        TIMESTAMPTZ,
  end_date          TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_vouchers_tenant ON vouchers(tenant_id);
CREATE INDEX idx_vouchers_code ON vouchers(tenant_id, code);

CREATE TRIGGER vouchers_updated_at BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add voucher_id to service_requests so we can track applied vouchers
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES vouchers(id),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2);

-- Helper function to safely increment voucher used_count
CREATE OR REPLACE FUNCTION increment_voucher_used_count(voucher_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE vouchers SET used_count = used_count + 1 WHERE id = voucher_id;
END;
$$;
