import { apiFetch } from './client';
import type { Notification, PaginatedResponse } from '@/types/api';

export const notificationsApi = {
  list: (page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<Notification>>(`/notifications?page=${page}&limit=${limit}`),

  unreadCount: () =>
    apiFetch<{ data: { unread_count: number } }>('/notifications/unread-count'),

  markRead: (id: string) =>
    apiFetch<{ data: { success: boolean } }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  markAllRead: () =>
    apiFetch<{ data: { success: boolean } }>('/notifications/read-all', {
      method: 'PATCH',
    }),
};
