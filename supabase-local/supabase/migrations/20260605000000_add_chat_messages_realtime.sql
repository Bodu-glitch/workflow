-- Enable full replica identity so Realtime sends complete row data
-- (chat_messages was already added to supabase_realtime in 20260420000000_add_chat_messages.sql)
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
