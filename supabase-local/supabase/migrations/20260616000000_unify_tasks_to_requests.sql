-- ============================================================
-- Unify Tasks → Requests
-- Xóa bảng tasks và task_assignments, dùng service_requests làm nguồn duy nhất
-- ============================================================

-- 1. Thêm moving và arrived vào request_status enum
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'moving' AFTER 'assigned';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'arrived' AFTER 'moving';

-- 2. Thêm location_radius_m vào service_requests (dùng cho GPS validation)
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS location_radius_m INTEGER DEFAULT 100;

-- 3. Tạo bảng request_service_items thay thế task_service_items
CREATE TABLE IF NOT EXISTS request_service_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  service_id UUID,
  label      TEXT NOT NULL,
  unit_price NUMERIC(12,2) DEFAULT 0,
  is_custom  BOOLEAN DEFAULT false,
  checked    BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE request_service_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON request_service_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_request_service_items_request_id ON request_service_items(request_id);

-- 4. Drop checkins (task_id NOT NULL, cần drop trước tasks)
DROP TABLE IF EXISTS checkins;

-- 5. Drop task-related tables
DROP TABLE IF EXISTS task_service_items;
DROP TABLE IF EXISTS task_assignments;

-- 6. Drop tasks table — CASCADE tự xóa FK constraints từ audit_logs và notifications
DROP TABLE IF EXISTS tasks CASCADE;

-- 7. Drop task_id column khỏi audit_logs và notifications (đã mất FK sau CASCADE)
ALTER TABLE audit_logs DROP COLUMN IF EXISTS task_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS task_id;

-- 8. Recreate checkins với request_id thay task_id
CREATE TABLE checkins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        checkin_type NOT NULL,
  gps_lat     DOUBLE PRECISION,
  gps_lng     DOUBLE PRECISION,
  gps_verified BOOLEAN NOT NULL DEFAULT false,
  photo_url   TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON checkins FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_checkins_request_id ON checkins(request_id);
CREATE INDEX idx_checkins_user_id    ON checkins(user_id);
