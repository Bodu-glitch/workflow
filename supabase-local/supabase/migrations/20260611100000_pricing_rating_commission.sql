-- ratings: photo attachment + problem report
ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS photo_url     TEXT,
  ADD COLUMN IF NOT EXISTS report_reason TEXT;

-- service_pricings: advanced pricing config
ALTER TABLE service_pricings
  ADD COLUMN IF NOT EXISTS travel_fee        NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surcharge_percent NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peak_hours_config JSONB   DEFAULT '[]'::jsonb;

-- tenants: commission split config
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS commission_config JSONB DEFAULT NULL;

-- Storage bucket for review photos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('review-photos', 'review-photos', true, 5242880)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "public read review photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-photos');

CREATE POLICY IF NOT EXISTS "authenticated upload review photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-photos');
