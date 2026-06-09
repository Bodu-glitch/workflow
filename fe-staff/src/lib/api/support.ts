import { apiFetch } from './client';

export interface SupportTicket {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  request?: { id: string; description: string } | null;
  last_message?: string | null;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  is_operator: boolean;
  created_at: string;
  sender?: { id: string; full_name: string; avatar_url?: string | null } | null;
}

export const supportApi = {
  listTickets: () =>
    apiFetch<{ data: SupportTicket[] }>('/support/tickets'),

  createTicket: (subject: string, request_id?: string) =>
    apiFetch<{ data: SupportTicket }>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify({ subject, request_id }),
    }),

  getMessages: (ticketId: string) =>
    apiFetch<{ data: SupportMessage[] }>(`/support/tickets/${ticketId}/messages`),

  sendMessage: (ticketId: string, content: string) =>
    apiFetch<{ data: SupportMessage }>(`/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};
