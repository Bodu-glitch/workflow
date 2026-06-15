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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'public read review photos') THEN
    CREATE POLICY "public read review photos" ON storage.objects FOR SELECT USING (bucket_id = 'review-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'authenticated upload review photos') THEN
    CREATE POLICY "authenticated upload review photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'review-photos');
  END IF;
END $$;
