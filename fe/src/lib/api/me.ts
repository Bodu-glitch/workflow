import { apiFetch } from './client';
import type { Task, TaskStatus, PaginatedResponse } from '@/types/api';

export const meApi = {
  tasks: (status?: TaskStatus, page = 1, limit = 20) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) q.set('status', status);
    return apiFetch<PaginatedResponse<Task>>(`/me/tasks?${q}`);
  },

  history: (page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<Task>>(`/me/tasks/history?page=${page}&limit=${limit}`),
};
