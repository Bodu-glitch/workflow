import { apiFetch } from './client';

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  is_operator: boolean;
  created_at: string;
  sender?: { id: string; full_name: string; avatar_url?: string | null } | null;
}

export interface SupportTicket {
  id: string;
  staff_id?: string;
  tenant_id?: string;
  request_id?: string | null;
  subject?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  staff?: { id: string; full_name: string; avatar_url?: string | null; phone?: string | null } | null;
  request?: { id: string; description: string; status: string } | null;
  tasks?: { id: string; title: string; status: string; location_name?: string } | null;
  users?: { id: string; full_name: string; avatar_url?: string } | null;
}

export interface TicketReply {
  id: string;
  content: string;
  created_at: string;
  users: { id: string; full_name: string; avatar_url?: string } | null;
}

export const supportApi = {
  /** BO/OT — list open/in_progress tickets from staff */
  listPending: (params: { page?: number; limit?: number } = {}) => {
    const q = params.page || params.limit
      ? `?page=${params.page ?? 1}&limit=${params.limit ?? 20}`
      : '';
    return apiFetch<{ data: SupportTicket[]; meta: { total: number; page: number; limit: number } }>(
      `/support/tickets/pending${q}`,
    );
  },

  allTickets: () =>
    apiFetch<{ data: SupportTicket[] }>('/support/tickets'),

  /** Get messages for a ticket */
  getMessages: (ticketId: string, page = 1, limit = 50) =>
    apiFetch<SupportMessage[]>(
      `/support/tickets/${ticketId}/messages?page=${page}&limit=${limit}`,
    ),

  ticketReplies: (ticketId: string) =>
    apiFetch<{ data: TicketReply[] }>(`/support/tickets/${ticketId}/replies`),

  /** Send a message to a ticket */
  sendMessage: (ticketId: string, content: string) =>
    apiFetch<SupportMessage>(`/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  reply: (ticketId: string, content: string) =>
    apiFetch<{ data: TicketReply }>(`/support/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  /** Update ticket status */
  updateStatus: (ticketId: string, status: 'in_progress' | 'resolved' | 'closed' | string) =>
    apiFetch<{ data: SupportTicket }>(`/support/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
