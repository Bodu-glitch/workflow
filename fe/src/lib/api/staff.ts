import { apiFetch } from './client';
import type { StaffMember, Invitation, InAppInvitation, PaginatedResponse } from '@/types/api';

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
};
