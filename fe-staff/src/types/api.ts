// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = 'superadmin' | 'business_owner' | 'operator' | 'staff';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  tenant_id: string | null;
  phone?: string;
  is_active: boolean;
  created_at: string;
  tenants?: TenantOption[];
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'assigned' | 'moving' | 'arrived' | 'in_progress' | 'completed' | 'completed_late' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskAssignee {
  id: string;
  full_name: string;
}

export interface CheckinRecord {
  gps_lat?: number;
  gps_lng?: number;
  photo_url?: string;
  notes?: string;
  checked_in_at?: string;
  checked_out_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  location_radius_m?: number;
  scheduled_at?: string;
  deadline?: string;
  cancel_reason?: string;
  reject_reason?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_note?: string;
  created_at: string;
  assignees: TaskAssignee[];
  checkin?: CheckinRecord;
  checkout?: CheckinRecord;
}

export interface DashboardStats {
  todo: number;
  in_progress: number;
  done: number;
  cancelled: number;
  rejected: number;
  overdue: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  location_radius_m?: number;
  scheduled_at?: string;
  deadline?: string;
  assignee_ids?: string[];
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_note?: string;
}

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'assignee_ids'>>;

// ─── Staff ───────────────────────────────────────────────────────────────────

export interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  token: string;
  status: string;
  created_at: string;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'task_created'
  | 'task_updated'
  | 'task_assigned'
  | 'task_cancelled'
  | 'task_rejected'
  | 'checkin'
  | 'checkout'
  | 'member_invited'
  | 'member_removed'
  | 'status_changed'
  | 'task_completed';

export interface AuditLog {
  id: string;
  action: AuditAction;
  actor_id: string;
  actor_name: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  task_id: string | null;
  request_id: string | null;
  is_read: boolean;
  data: Record<string, unknown>;
  created_at: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
  role: UserRole;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

// ─── Auth (extended) ──────────────────────────────────────────────────────────

export interface GoogleOnboardingResponse {
  access_token: string;
  user: UserProfile;
  tenant: TenantInfo;
}

// ─── Workspace Applications ───────────────────────────────────────────────────

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface WorkspaceApplication {
  id: string;
  status: ApplicationStatus;
  message?: string;
  applied_at: string;
  reviewed_at?: string;
  tenants: TenantInfo;
}

export interface WorkspaceSearchResult {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  industry?: string | null;
  operating_area?: string | null;
  benefits?: string | null;
  income_level?: string | null;
  policies?: string | null;
}

// ─── Work Schedule ────────────────────────────────────────────────────────────

export interface WorkShift {
  id: string;
  tenant_id: string;
  name: string;
  start_time: string; // "HH:MM"
  end_time: string;
  color: string;
  created_at: string;
}

export interface MyShiftAssignment {
  id: string;
  work_date: string;
  note?: string;
  work_shifts: Pick<WorkShift, 'id' | 'name' | 'start_time' | 'end_time' | 'color'>;
}

export type LeaveType = 'annual' | 'sick' | 'personal' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  user_id: string;
  tenant_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  reason?: string;
  status: LeaveStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  reject_reason?: string;
  created_at: string;
}

// ─── In-app invitations (received by the logged-in user) ─────────────────────

export interface InAppInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: UserRole;
  delivery: 'in_app';
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: string;
  created_at: string;
  tenants: TenantInfo;
}
