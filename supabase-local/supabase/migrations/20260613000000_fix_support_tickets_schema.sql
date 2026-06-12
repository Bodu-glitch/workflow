-- Add missing columns to support_tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS staff_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject    TEXT DEFAULT 'Hỗ trợ',
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL;

-- Backfill staff_id from created_by
UPDATE support_tickets SET staff_id = created_by WHERE staff_id IS NULL;

-- Add index for FK join
CREATE INDEX IF NOT EXISTS support_tickets_staff_id_idx ON support_tickets(staff_id);

-- Allow 'closed' status
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));
