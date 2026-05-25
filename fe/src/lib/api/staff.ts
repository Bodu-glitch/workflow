import { apiFetch } from './client';
import type { StaffMember, Invitation, InAppInvitation, PaginatedResponse, WorkspaceApplication, ViolationNote } from '@/types/api';

export const staffApi = {
  list: (page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<StaffMember>>(`/staff?page=${page}&limit=${limit}`),

  invitations: (page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<Invitation>>(`/staff/invitations?page=${page}&limit=${limit}`),

  invite: (email: string, role: 'staff' | 'operator' = 'staff') =>
    apiFetch<{ data: Invitation }>('/staff/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  resendInvite: (id: string) =>
    apiFetch<{ data: { success: boolean } }>(`/staff/invite/${id}/resend`, {
      method: 'POST',
    }),

  remove: (id: string) =>
    apiFetch<{ data: { success: boolean } }>(`/staff/${id}`, {
      method: 'DELETE',
    }),

  acceptInvitationGoogle: (access_token: string, invitation_token: string) =>
    apiFetch<{ data: { user: StaffMember & { tenant_id: string }; tenant: { id: string; name: string; slug: string } } }>('/staff/accept-invitation-google', {
      method: 'POST',
      body: JSON.stringify({ access_token, invitation_token }),
    }),

  myInvitations: () =>
    apiFetch<{ data: { data: InAppInvitation[] } }>('/staff/my-invitations'),

  acceptInvitation: (id: string) =>
    apiFetch<{ data: { message: string } }>(`/staff/invitations/${id}/accept`, {
      method: 'PATCH',
    }),

  declineInvitation: (id: string) =>
    apiFetch<{ data: { message: string } }>(`/staff/invitations/${id}/decline`, {
      method: 'PATCH',
    }),

  applications: (page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<WorkspaceApplication>>(`/staff/applications?page=${page}&limit=${limit}`),

  approveApplication: (id: string) =>
    apiFetch<{ data: { message: string } }>(`/staff/applications/${id}/approve`, {
      method: 'PATCH',
    }),

  rejectApplication: (id: string) =>
    apiFetch<{ data: { message: string } }>(`/staff/applications/${id}/reject`, {
      method: 'PATCH',
    }),

  /** PATCH /staff/:id/lock — BO only */
  lock: (id: string, reason?: string) =>
    apiFetch<{ data: { user_id: string; is_active: boolean } }>(`/staff/${id}/lock`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  /** PATCH /staff/:id/unlock — BO only */
  unlock: (id: string) =>
    apiFetch<{ data: { user_id: string; is_active: boolean } }>(`/staff/${id}/unlock`, {
      method: 'PATCH',
    }),

  /** PATCH /staff/me/online-status — staff/OT/BO */
  updateOnlineStatus: (status: 'online' | 'offline' | 'working') =>
    apiFetch<{ data: { status: string } }>('/staff/me/online-status', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // ── Violation Notes ───────────────────────────────────────────────────────

  listViolations: (staffId: string) =>
    apiFetch<{ data: ViolationNote[] }>(`/staff/${staffId}/violations`),

  addViolation: (staffId: string, content: string) =>
    apiFetch<{ data: ViolationNote }>(`/staff/${staffId}/violations`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deleteViolation: (staffId: string, noteId: string) =>
    apiFetch<{ data: { success: boolean } }>(`/staff/${staffId}/violations/${noteId}`, {
      method: 'DELETE',
    }),
};
