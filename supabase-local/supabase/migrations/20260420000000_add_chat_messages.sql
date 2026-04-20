CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_tenant_created_idx ON chat_messages(tenant_id, created_at ASC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_read_chat" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_tenants.user_id = auth.uid()
        AND user_tenants.tenant_id = chat_messages.tenant_id
        AND user_tenants.is_active = true
    )
  );

CREATE POLICY "tenant_members_send_chat" ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_tenants.user_id = auth.uid()
        AND user_tenants.tenant_id = chat_messages.tenant_id
        AND user_tenants.is_active = true
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
