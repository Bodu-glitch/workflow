import { apiFetch } from './client';
import type {
  WorkShift,
  ShiftAssignment,
  MyShiftAssignment,
  LeaveRequest,
  LeaveType,
  LeaveStatus,
} from '@/types/api';

export const scheduleApi = {
  // ── Shifts (BO/OT) ────────────────────────────────────────────────────────
  // Service returns array → interceptor wraps → { data: WorkShift[] }
  listShifts: () =>
    apiFetch<{ data: WorkShift[] }>('/work-schedule/shifts'),

  createShift: (dto: { name: string; start_time: string; end_time: string; color?: string }) =>
    apiFetch<{ data: WorkShift }>('/work-schedule/shifts', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  deleteShift: (id: string) =>
    apiFetch<{ data: { success: boolean } }>(`/work-schedule/shifts/${id}`, {
      method: 'DELETE',
    }),

  // ── Assignments (BO/OT) ───────────────────────────────────────────────────
  getAssignments: (from: string, to: string) =>
    apiFetch<{ data: ShiftAssignment[] }>(
      `/work-schedule/assignments?from=${from}&to=${to}`,
    ),

  createAssignment: (dto: { shift_id: string; user_ids: string[]; work_date: string; note?: string }) =>
    apiFetch<{ data: ShiftAssignment[] }>('/work-schedule/assignments', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  deleteAssignment: (id: string) =>
    apiFetch<{ data: { success: boolean } }>(`/work-schedule/assignments/${id}`, {
      method: 'DELETE',
    }),

  // ── Leave Requests (BO/OT) ────────────────────────────────────────────────
  listLeaveRequests: (status?: LeaveStatus | '') =>
    apiFetch<{ data: LeaveRequest[] }>(
      `/work-schedule/leave-requests${status ? `?status=${status}` : ''}`,
    ),

  reviewLeaveRequest: (id: string, action: 'approved' | 'rejected', reject_reason?: string) =>
    apiFetch<{ data: LeaveRequest }>(`/work-schedule/leave-requests/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ action, reject_reason }),
    }),

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
