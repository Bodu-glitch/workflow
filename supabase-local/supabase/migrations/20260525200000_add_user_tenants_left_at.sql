-- Add left_at to user_tenants to distinguish "left/removed" from "locked by BO".
-- NULL  = active member OR locked by BO (is_active=false, lock_reason set)
-- NOT NULL = left voluntarily or removed by BO (data preserved, access revoked)
ALTER TABLE user_tenants ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;
