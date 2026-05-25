-- Add 'pending' status for tenants awaiting superadmin approval
ALTER TYPE tenant_status ADD VALUE IF NOT EXISTS 'pending';
