-- Add CCCD field to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cccd TEXT;

-- User certificates table
CREATE TABLE IF NOT EXISTS public.user_certificates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_certificates_user_id_idx ON public.user_certificates(user_id);

-- Storage bucket for certificates (public read for BO/OT review)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificates',
  'certificates',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone authenticated can upload to their own folder
CREATE POLICY "Users upload own certificates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Certificates public read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'certificates');

CREATE POLICY "Users delete own certificates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
