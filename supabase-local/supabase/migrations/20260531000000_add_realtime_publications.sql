-- Enable realtime for invitations table
ALTER TABLE invitations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE invitations;

-- Enable realtime for workspace_applications table
ALTER TABLE workspace_applications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_applications;
