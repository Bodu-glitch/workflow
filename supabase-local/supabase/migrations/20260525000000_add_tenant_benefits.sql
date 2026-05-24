-- Add benefits field to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS benefits TEXT;
