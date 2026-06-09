import { apiFetch } from './client';

export interface SupportTicket {
  id: string;
  subject?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  request?: { id: string; description: string } | null;
  last_message?: string | null;
  tasks?: { id: string; title: string; status: string; location_name?: string } | null;
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

export interface TicketReply {
  id: string;
  content: string;
  created_at: string;
  users: { id: string; full_name: string; avatar_url?: string } | null;
}

export const supportApi = {
  listTickets: () =>
    apiFetch<{ data: SupportTicket[] }>('/support/tickets'),

  /** Create ticket by subject + optional request_id (HEAD) */
  createTicket: (subject: string, request_id?: string) =>
    apiFetch<{ data: SupportTicket }>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify({ subject, request_id }),
    }),

  /** Create ticket by task_id + description (origin) */
  createTicketByTask: (task_id: string, description: string) =>
    apiFetch<{ data: { ticket: SupportTicket; task: any } }>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify({ task_id, description }),
    }),

  myTickets: () =>
    apiFetch<{ data: SupportTicket[] }>('/support/tickets/mine'),

  getMessages: (ticketId: string) =>
    apiFetch<{ data: SupportMessage[] }>(`/support/tickets/${ticketId}/messages`),

  sendMessage: (ticketId: string, content: string) =>
    apiFetch<{ data: SupportMessage }>(`/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  ticketReplies: (ticketId: string) =>
    apiFetch<{ data: TicketReply[] }>(`/support/tickets/${ticketId}/replies`),
};
