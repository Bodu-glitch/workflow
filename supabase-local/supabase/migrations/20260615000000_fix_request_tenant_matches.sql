ALTER TABLE request_tenant_matches
  DROP CONSTRAINT IF EXISTS request_tenant_matches_request_id_tenant_id_key;

ALTER TABLE request_tenant_matches
  ADD CONSTRAINT request_tenant_matches_request_id_pricing_id_key
  UNIQUE (request_id, pricing_id);
