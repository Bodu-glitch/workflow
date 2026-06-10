-- Multiple addresses for customer users
ALTER TABLE users ADD COLUMN IF NOT EXISTS addresses JSONB DEFAULT '[]'::jsonb;

-- Add tenant_id to ratings for direct tenant-level queries
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Backfill tenant_id from service_requests
UPDATE ratings r
SET tenant_id = sr.tenant_id
FROM service_requests sr
WHERE r.request_id = sr.id
  AND r.tenant_id IS NULL;

-- Rating cache + location on tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Backfill tenant rating caches from existing data
UPDATE tenants t SET
  rating_avg   = sub.avg_score,
  rating_count = sub.cnt
FROM (
  SELECT tenant_id,
         AVG(score)::NUMERIC(3,2) AS avg_score,
         COUNT(*)::INTEGER        AS cnt
  FROM ratings
  WHERE tenant_id IS NOT NULL
  GROUP BY tenant_id
) sub
WHERE t.id = sub.tenant_id;

-- Keep tenant rating cache up-to-date on new ratings
CREATE OR REPLACE FUNCTION update_tenant_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    UPDATE tenants SET
      rating_avg   = (SELECT AVG(score)::NUMERIC(3,2) FROM ratings WHERE tenant_id = NEW.tenant_id),
      rating_count = (SELECT COUNT(*)::INTEGER        FROM ratings WHERE tenant_id = NEW.tenant_id)
    WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ratings_update_tenant_avg ON ratings;
CREATE TRIGGER ratings_update_tenant_avg
  AFTER INSERT OR UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_tenant_rating();
