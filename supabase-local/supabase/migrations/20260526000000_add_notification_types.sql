-- Add new notification types for support tickets and chat messages
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'support_ticket_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_chat_message';
