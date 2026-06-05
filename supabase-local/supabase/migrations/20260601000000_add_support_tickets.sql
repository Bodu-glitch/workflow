-- Add support_reply to notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'support_reply';

-- Support tickets
CREATE TABLE support_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX support_tickets_tenant_idx     ON support_tickets(tenant_id);
CREATE INDEX support_tickets_created_by_idx ON support_tickets(created_by);
CREATE INDEX support_tickets_task_id_idx    ON support_tickets(task_id);

-- Extend chat_messages with support fields
ALTER TABLE chat_messages
  ADD COLUMN type      TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'task_card')),
  ADD COLUMN task_id   UUID REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL;

CREATE INDEX chat_messages_ticket_idx ON chat_messages(ticket_id) WHERE ticket_id IS NOT NULL;
