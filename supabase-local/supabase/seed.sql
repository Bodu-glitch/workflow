-- Seed: create superadmin for local development
-- The on_auth_user_created trigger (from migration 20260320000000) auto-inserts into public.users

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, instance_id,
  raw_user_meta_data
)
SELECT
  gen_random_uuid(),
  'superadmin@system.local',
  crypt('superadmin123', gen_salt('bf', 10)),
  now(), now(), now(),
  'authenticated', 'authenticated',
  '00000000-0000-0000-0000-000000000000',
  '{"full_name": "Super Admin"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'superadmin@system.local'
);

-- The trigger creates public.users with role='staff'; update to superadmin
UPDATE public.users
SET role = 'superadmin', full_name = 'Super Admin'
WHERE email = 'superadmin@system.local';
