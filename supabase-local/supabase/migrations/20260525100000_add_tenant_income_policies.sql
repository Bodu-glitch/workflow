-- Add income_level and policies columns to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS income_level TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS policies TEXT;
