import { apiFetch } from './client';

export interface SupportTicket {
  id: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
  tasks: { id: string; title: string; status: string; location_name?: string } | null;
  users: { id: string; full_name: string; avatar_url?: string } | null;
}

export interface TicketReply {
  id: string;
  content: string;
  created_at: string;
  users: { id: string; full_name: string; avatar_url?: string } | null;
}

export const supportApi = {
  allTickets: () =>
    apiFetch<{ data: SupportTicket[] }>('/support/tickets'),

  ticketReplies: (ticketId: string) =>
    apiFetch<{ data: TicketReply[] }>(`/support/tickets/${ticketId}/replies`),

  reply: (ticketId: string, content: string) =>
    apiFetch<{ data: TicketReply }>(`/support/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  updateStatus: (ticketId: string, status: string) =>
    apiFetch<{ data: SupportTicket }>(`/support/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
