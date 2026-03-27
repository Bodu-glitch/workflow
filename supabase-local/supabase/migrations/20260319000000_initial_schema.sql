-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE user_role AS ENUM ('superadmin', 'business_owner', 'operator', 'staff');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled', 'rejected');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'cancelled', 'expired');
CREATE TYPE invitation_delivery AS ENUM ('email', 'in_app');
CREATE TYPE checkin_type AS ENUM ('checkin', 'checkout');
CREATE TYPE audit_action AS ENUM (
  'task_created', 'task_updated', 'task_assigned', 'task_cancelled',
  'task_rejected', 'checkin', 'checkout', 'member_invited', 'member_removed',
  'status_changed', 'task_completed'
);
CREATE TYPE notification_type AS ENUM (
  'task_assigned', 'task_updated', 'status_changed', 'task_completed',
  'task_rejected', 'task_cancelled', 'reminder', 'invitation_received'
);
CREATE TYPE tenant_status AS ENUM ('active', 'inactive', 'suspended');

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status tenant_status NOT NULL DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'staff',  -- CHỈ dùng cho superadmin; các user khác dùng user_tenants.role
  phone         TEXT,
  avatar_url    TEXT,
  device_token  TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role       user_role NOT NULL DEFAULT 'staff',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id),
  CHECK (role != 'superadmin')
);

CREATE TABLE invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'staff',
  token           TEXT NOT NULL UNIQUE,
  status          invitation_status NOT NULL DEFAULT 'pending',
  delivery        invitation_delivery NOT NULL DEFAULT 'email',
  invited_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  invited_by      UUID NOT NULL REFERENCES users(id),
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  location_name TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_radius_m INTEGER NOT NULL DEFAULT 100,
  scheduled_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  cancel_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

CREATE TABLE checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type checkin_type NOT NULL,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  gps_verified BOOLEAN NOT NULL DEFAULT false,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant_id ON user_tenants(tenant_id);
CREATE INDEX idx_invitations_tenant_id ON invitations(tenant_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_invited_user_id ON invitations(invited_user_id);
CREATE INDEX idx_tasks_tenant_id ON tasks(tenant_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX idx_task_assignments_user_id ON task_assignments(user_id);
CREATE INDEX idx_checkins_task_id ON checkins(task_id);
CREATE INDEX idx_checkins_user_id ON checkins(user_id);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_task_id ON audit_logs(task_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_tenants_updated_at BEFORE UPDATE ON user_tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Seed superadmin user (password: superadmin123)
-- ============================================================
DO $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, aud, role, instance_id
  ) VALUES (
    v_id,
    'superadmin@system.local',
    '$2b$10$K7L.8K5pqEkfQOCHmKVEiebO1X5R9hX0E.8xBSYXIVJp3q0yz23Re',
    now(), now(), now(),
    'authenticated', 'authenticated',
    '00000000-0000-0000-0000-000000000000'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role)
  VALUES (v_id, 'superadmin@system.local', 'Super Admin', 'superadmin')
  ON CONFLICT (id) DO NOTHING;
END $$;
