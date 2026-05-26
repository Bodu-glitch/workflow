-- Enable full replica identity so Realtime sends complete row data
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Add notifications to the Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable Row Level Security (required for per-user Realtime filtering)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only receive Realtime events for their own notifications
CREATE POLICY "users_read_own_notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);