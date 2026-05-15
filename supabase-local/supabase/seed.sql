-- Seed: create superadmin for local development
-- The on_auth_user_created trigger (from migration 20260320000000) auto-inserts into public.users

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, aud, role, instance_id,
  raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  gen_random_uuid(),
  'superadmin@system.local',
  '$2a$10$ciONeDAcbgBCVpfsyiyPp.ciW6HFRHZap5/zK6y3wBoB2IUB5sSbW',
  now(), now(), now(),
  'authenticated', 'authenticated',
  '00000000-0000-0000-0000-000000000000',
  '{"full_name": "Super Admin"}'::jsonb,
  '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'superadmin@system.local'
);

-- The trigger creates public.users with role='staff'; update to superadmin
UPDATE public.users
SET role = 'superadmin', full_name = 'Super Admin'
WHERE email = 'superadmin@system.local';
