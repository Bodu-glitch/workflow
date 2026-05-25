-- Add online_status to user_tenants for real-time presence tracking
-- Staff app updates this field; BO can see current status in the employee list.
-- Values: 'offline' (default), 'online' (app open), 'working' (active task check-in)
ALTER TABLE user_tenants
  ADD COLUMN IF NOT EXISTS online_status VARCHAR(20) NOT NULL DEFAULT 'offline'
  CHECK (online_status IN ('online', 'offline', 'working'));
