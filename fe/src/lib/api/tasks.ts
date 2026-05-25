import { apiFetch } from './client';
import type {
  Task,
  DashboardStats,
  TaskChartData,
  CreateTaskInput,
  UpdateTaskInput,
  PaginatedResponse,
  TaskStatus,
  TaskPriority,
} from '@/types/api';

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  area?: string;
  service_type?: string;
  assignee_id?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
  overdue?: boolean;
}

export interface TaskFilterOptions {
  areas: string[];
  service_types: string[];
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

export const tasksApi = {
  dashboard: (from?: string, to?: string) =>
    apiFetch<{ data: { summary: DashboardStats; on_task_staff: number; unassigned_staff: number; total_staff: number } }>(`/tasks/dashboard${buildQuery({ from, to })}`),

  chartData: (period: 'week' | 'month' | 'year') =>
    apiFetch<{ data: TaskChartData }>(`/tasks/chart?period=${period}`),

  downloadReport: (period: 'month' | 'year', date: string, format: 'excel' | 'pdf') =>
    apiFetch<Blob>(`/tasks/report?period=${period}&date=${date}&format=${format}`, {}, true),

  filterOptions: () =>
    apiFetch<{ data: TaskFilterOptions }>('/tasks/filter-options'),

  list: (filters: TaskFilters = {}) =>
    apiFetch<PaginatedResponse<Task>>(`/tasks${buildQuery(filters as Record<string, string | number | undefined>)}`),

  get: (id: string) =>
    apiFetch<{ data: Task }>(`/tasks/${id}`),

  create: (input: CreateTaskInput) =>
    apiFetch<{ data: Task }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, input: UpdateTaskInput) =>
    apiFetch<{ data: Task }>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  assign: (id: string, assignee_ids: string[]) =>
    apiFetch<{ data: Task }>(`/tasks/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignee_ids }),
    }),

  unassign: (id: string, staffId: string) =>
    apiFetch<{ data: { success: boolean } }>(`/tasks/${id}/assign/${staffId}`, {
      method: 'DELETE',
    }),

  cancel: (id: string, cancel_reason?: string) =>
    apiFetch<{ data: Task }>(`/tasks/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ cancel_reason }),
    }),

  reject: (id: string, reason?: string) =>
    apiFetch<{ data: Task }>(`/tasks/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  checkin: (id: string, form: FormData) =>
    apiFetch<{ data: Task }>(`/tasks/${id}/checkin`, {
      method: 'POST',
      body: form,
    }),

  checkout: (id: string, form: FormData) =>
    apiFetch<{ data: Task }>(`/tasks/${id}/checkout`, {
      method: 'POST',
      body: form,
    }),
};
