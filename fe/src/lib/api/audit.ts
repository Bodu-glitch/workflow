import { apiFetch } from './client';
import type { AuditLog, AuditAction, PaginatedResponse } from '@/types/api';

export const auditApi = {
  list: (action?: AuditAction, page = 1, limit = 20) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (action) q.set('action', action);
    return apiFetch<PaginatedResponse<AuditLog>>(`/audit?${q}`);
  },

  byTask: (taskId: string, page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<AuditLog>>(`/audit/tasks/${taskId}?page=${page}&limit=${limit}`),

  byStaff: (staffId: string, page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<AuditLog>>(`/audit/staff/${staffId}?page=${page}&limit=${limit}`),
};
