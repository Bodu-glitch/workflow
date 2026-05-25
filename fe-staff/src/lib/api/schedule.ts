import { apiFetch } from './client';
import type { MyShiftAssignment, LeaveRequest, LeaveType } from '@/types/api';

export const scheduleApi = {
  // ── Me (staff) ────────────────────────────────────────────────────────────
  myAssignments: (from: string, to: string) =>
    apiFetch<{ data: MyShiftAssignment[] }>(
      `/work-schedule/me/assignments?from=${from}&to=${to}`,
    ),

  myLeaveRequests: () =>
    apiFetch<{ data: LeaveRequest[] }>('/work-schedule/me/leave-requests'),

  createLeaveRequest: (dto: { type: LeaveType; start_date: string; end_date: string; reason?: string }) =>
    apiFetch<{ data: LeaveRequest }>('/work-schedule/me/leave-requests', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
};
