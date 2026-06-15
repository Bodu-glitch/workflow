ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS qr_payment_url text,
  ADD COLUMN IF NOT EXISTS commission_platform_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_staff_percent numeric DEFAULT 0;
