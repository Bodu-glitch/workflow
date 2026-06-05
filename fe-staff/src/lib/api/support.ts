import { apiFetch } from './client';

export interface SupportTicket {
  id: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
  tasks: { id: string; title: string; status: string; location_name?: string } | null;
}

export interface TicketReply {
  id: string;
  content: string;
  created_at: string;
  users: { id: string; full_name: string; avatar_url?: string } | null;
}

export const supportApi = {
  createTicket: (task_id: string, description: string) =>
    apiFetch<{ data: { ticket: SupportTicket; task: any } }>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify({ task_id, description }),
    }),

  myTickets: () =>
    apiFetch<{ data: SupportTicket[] }>('/support/tickets/mine'),

  ticketReplies: (ticketId: string) =>
    apiFetch<{ data: TicketReply[] }>(`/support/tickets/${ticketId}/replies`),
};
