-- Add 'overdue' to notification_type enum
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction block
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'overdue';
