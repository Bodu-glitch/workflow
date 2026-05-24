import { apiFetch } from './client';
import type { StaffMember, Invitation, InAppInvitation, PaginatedResponse, WorkspaceApplication, WorkspaceSearchResult } from '@/types/api';

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
    apiFetch<{ data: InAppInvitation[] }>('/staff/my-invitations'),

  acceptInvitation: (id: string) =>
    apiFetch<{ data: { message: string } }>(`/staff/invitations/${id}/accept`, {
      method: 'PATCH',
    }),

  declineInvitation: (id: string) =>
    apiFetch<{ data: { message: string } }>(`/staff/invitations/${id}/decline`, {
      method: 'PATCH',
    }),

  searchWorkspaces: (
    q: string,
    filters: { industry?: string; area?: string; benefits?: string } = {},
  ) => {
    const params = new URLSearchParams({ q });
    if (filters.industry) params.set('industry', filters.industry);
    if (filters.area) params.set('area', filters.area);
    if (filters.benefits) params.set('benefits', filters.benefits);
    return apiFetch<{ data: WorkspaceSearchResult[] }>(`/staff/search-workspaces?${params.toString()}`);
  },

  apply: (tenantId: string, message?: string) =>
    apiFetch<{ data: { message: string; application: { id: string; status: string; tenant: WorkspaceSearchResult } } }>('/staff/apply', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: tenantId, message }),
    }),

  myApplications: () =>
    apiFetch<{ data: WorkspaceApplication[] }>('/staff/my-applications'),

  withdrawApplication: (id: string) =>
    apiFetch<{ data: { message: string } }>(`/staff/applications/${id}/withdraw`, {
      method: 'PATCH',
    }),

  /** PATCH /staff/me/online-status — cập nhật trạng thái online của bản thân */
  updateOnlineStatus: (status: 'online' | 'offline' | 'working') =>
    apiFetch<{ data: { status: string } }>('/staff/me/online-status', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
