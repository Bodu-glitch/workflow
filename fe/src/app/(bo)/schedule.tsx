import React, { useState, useMemo, useEffect } from 'react';
import { ScrollView, TouchableOpacity, Modal, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, TextInput } from '@/tw';
import { scheduleApi } from '@/lib/api/schedule';
import { staffApi } from '@/lib/api/staff';
import { useToast } from '@/context/toast';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import type { WorkShift, ShiftAssignment, LeaveRequest, LeaveType } from '@/types/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekDates(anchor: Date) {
  const day = anchor.getDay(); // 0=Sun
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

const DOW_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: 'Nghỉ phép năm',
  sick: 'Nghỉ bệnh',
  personal: 'Việc riêng',
  other: 'Khác',
};

const LEAVE_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: 'Chờ duyệt', bg: '#fef3c7', color: '#92400e' },
  approved: { label: 'Đã duyệt',  bg: '#dcfce7', color: '#15803d' },
  rejected: { label: 'Từ chối',   bg: '#fee2e2', color: '#dc2626' },
};

const SHIFT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function dateDiffDays(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;
}

function fmtDateVN(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Avatar initials ─────────────────────────────────────────────────────────
function Initials({ name, size = 28, color = '#3B82F6' }: { name: string; size?: number; color?: string }) {
  const parts = name.trim().split(' ');
  const txt = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color }}>{txt.toUpperCase()}</Text>
    </View>
  );
}

// ─── Leave Request Card ───────────────────────────────────────────────────────
function LeaveCard({
  req,
  onApprove,
  onReject,
  loading,
}: {
  req: LeaveRequest;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
}) {
  const cfg = LEAVE_STATUS_CONFIG[req.status];
  const days = dateDiffDays(req.start_date, req.end_date);
  const user = req.users;

  return (
    <View className="bg-white rounded-2xl mb-3 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <View className="p-4">
        <View className="flex-row items-center gap-3 mb-3">
          {user && <Initials name={user.full_name} size={40} />}
          <View className="flex-1">
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text className="font-bold text-on-surface text-base">{user?.full_name ?? '—'}</Text>
              <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
              </View>
            </View>
            <Text className="text-on-surface-variant text-xs mt-0.5">{user?.email}</Text>
          </View>
        </View>

        <View className="flex-row gap-4 mb-2">
          <View className="flex-1">
            <Text className="text-xs text-on-surface-variant mb-0.5">Loại nghỉ</Text>
            <Text className="text-sm font-semibold text-on-surface">{LEAVE_TYPE_LABEL[req.type]}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-on-surface-variant mb-0.5">Thời gian</Text>
            <Text className="text-sm font-semibold text-on-surface">
              {fmtDateVN(req.start_date)} – {fmtDateVN(req.end_date)}
            </Text>
            <Text className="text-xs text-on-surface-variant">{days} ngày</Text>
          </View>
        </View>

        {req.reason ? (
          <View className="bg-surface-variant rounded-xl p-3 mt-1">
            <Text className="text-xs text-on-surface-variant mb-0.5">Lý do</Text>
            <Text className="text-sm text-on-surface">{req.reason}</Text>
          </View>
        ) : null}

        {req.reject_reason ? (
          <View className="bg-red-50 rounded-xl p-3 mt-2">
            <Text className="text-xs text-red-500 mb-0.5">Lý do từ chối</Text>
            <Text className="text-sm text-red-700">{req.reject_reason}</Text>
          </View>
        ) : null}
      </View>

      {req.status === 'pending' && (
        <View className="flex-row border-t border-surface-variant">
          <Pressable
            onPress={onReject}
            disabled={loading}
            className="flex-1 items-center py-3"
            style={{ borderRightWidth: 1, borderRightColor: '#e5e7eb' }}
          >
            <Text className="text-sm font-semibold text-red-500">✗ Từ chối</Text>
          </Pressable>
          <Pressable onPress={onApprove} disabled={loading} className="flex-1 items-center py-3">
            <Text className="text-sm font-semibold text-green-600">✓ Duyệt</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function BOScheduleScreen() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();

  // ── Realtime: ca làm việc + đơn nghỉ phép ───────────────────────────────
  useEffect(() => {
    const tenantId = user?.tenant_id;
    if (!tenantId) return;

    const channel = supabase
      .channel(`schedule:${tenantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shift_assignments',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['shift-assignments'] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leave_requests',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['leave-requests'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.tenant_id, qc]);

  const [tab, setTab] = useState<'shifts' | 'leaves'>('shifts');

  // ── Week navigation ─────────────────────────────────────────────────────
  const [anchor, setAnchor] = useState(new Date());
  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);
  const [selectedIdx, setSelectedIdx] = useState(() => {
    const today = new Date();
    const wd = getWeekDates(today);
    const idx = wd.findIndex((d) => toISO(d) === toISO(today));
    return idx >= 0 ? idx : 0;
  });
  const selectedDate = weekDates[selectedIdx];

  const fromISO = toISO(weekDates[0]);
  const toISO2 = toISO(weekDates[6]);

  // ── Data ────────────────────────────────────────────────────────────────
  const { data: shiftsData } = useQuery({
    queryKey: ['work-shifts'],
    queryFn: () => scheduleApi.listShifts(),
  });
  const shifts: WorkShift[] = shiftsData?.data ?? [];

  const { data: assignData, isLoading: assignLoading } = useQuery({
    queryKey: ['shift-assignments', fromISO, toISO2],
    queryFn: () => scheduleApi.getAssignments(fromISO, toISO2),
  });
  const assignments: ShiftAssignment[] = assignData?.data ?? [];

  // ── Leave filter (must be declared before the useQuery that uses it) ───────
  const [leaveFilter, setLeaveFilter] = useState<'' | 'pending' | 'approved' | 'rejected'>('');

  const { data: leaveData } = useQuery({
    queryKey: ['leave-requests', leaveFilter],
    queryFn: () => scheduleApi.listLeaveRequests(leaveFilter || undefined),
  });
  const leaves: LeaveRequest[] = leaveData?.data ?? [];

  // ── Shift form modal ────────────────────────────────────────────────────
  const [shiftModal, setShiftModal] = useState(false);
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('08:00');
  const [newShiftEnd, setNewShiftEnd] = useState('17:00');
  const [newShiftColor, setNewShiftColor] = useState(SHIFT_COLORS[0]);

  const createShiftMut = useMutation({
    mutationFn: () =>
      scheduleApi.createShift({ name: newShiftName, start_time: newShiftStart, end_time: newShiftEnd, color: newShiftColor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-shifts'] });
      showToast(`Ca "${newShiftName}" đã được thêm`, 'success', 'Đã tạo ca');
      setShiftModal(false);
      setNewShiftName('');
    },
    onError: (e: any) => showToast(e.message, 'error', 'Lỗi'),
  });

  const deleteShiftMut = useMutation({
    mutationFn: (id: string) => scheduleApi.deleteShift(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-shifts'] });
      qc.invalidateQueries({ queryKey: ['shift-assignments'] });
    },
  });

  // ── Assign modal ────────────────────────────────────────────────────────
  const [assignModal, setAssignModal] = useState<WorkShift | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list(1, 100),
    enabled: !!assignModal,
  });
  const staffList = useMemo(
    () => (staffData?.data ?? []).filter((s) => s.is_active),
    [staffData],
  );

  // which users are already assigned to this shift on selected date
  const alreadyAssigned = useMemo(() => {
    if (!assignModal) return new Set<string>();
    return new Set(
      assignments
        .filter((a) => a.work_shifts.id === assignModal.id && a.work_date === toISO(selectedDate))
        .map((a) => a.users.id),
    );
  }, [assignModal, assignments, selectedDate]);

  const assignMut = useMutation({
    mutationFn: () =>
      scheduleApi.createAssignment({
        shift_id: assignModal!.id,
        user_ids: selectedUsers.filter((id) => !alreadyAssigned.has(id)),
        work_date: toISO(selectedDate),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-assignments'] });
      showToast('Nhân viên đã được thêm vào ca', 'success', 'Đã phân ca');
      setAssignModal(null);
      setSelectedUsers([]);
    },
    onError: (e: any) => showToast(e.message, 'error', 'Lỗi'),
  });

  const removeAssignMut = useMutation({
    mutationFn: (id: string) => scheduleApi.deleteAssignment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-assignments'] }),
  });

  // ── Leave review ────────────────────────────────────────────────────────
  const reviewMut = useMutation({
    mutationFn: ({ id, action, reject_reason }: { id: string; action: 'approved' | 'rejected'; reject_reason?: string }) =>
      scheduleApi.reviewLeaveRequest(id, action, reject_reason),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      showToast(
        vars.action === 'approved' ? 'Đơn nghỉ phép đã được chấp thuận' : 'Đơn nghỉ phép bị từ chối',
        vars.action === 'approved' ? 'success' : 'info',
        vars.action === 'approved' ? 'Đã duyệt' : 'Đã từ chối',
      );
    },
    onError: (e: any) => showToast(e.message, 'error', 'Lỗi'),
  });

  function handleReject(req: LeaveRequest) {
    Alert.prompt?.(
      'Lý do từ chối',
      'Nhập lý do từ chối đơn nghỉ phép',
      (reason) => reviewMut.mutate({ id: req.id, action: 'rejected', reject_reason: reason }),
      'plain-text',
    );
    // On web/Android without Alert.prompt — just reject without reason
    if (!Alert.prompt) {
      reviewMut.mutate({ id: req.id, action: 'rejected' });
    }
  }

  // ── Day assignments ─────────────────────────────────────────────────────
  const dayAssignments = useMemo(
    () => assignments.filter((a) => a.work_date === toISO(selectedDate)),
    [assignments, selectedDate],
  );

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-5 pt-12 pb-3 bg-white">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-extrabold text-on-surface">Lịch làm việc</Text>
        </View>

        {/* Tabs */}
        <View className="flex-row gap-1 mt-4 bg-surface-variant rounded-xl p-1">
          {([['shifts', 'Ca làm việc'], ['leaves', 'Nghỉ phép']] as const).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              className="flex-1 py-2 rounded-lg items-center"
              style={{ backgroundColor: tab === key ? '#fff' : 'transparent' }}
            >
              <Text style={{ fontSize: 13, fontWeight: tab === key ? '700' : '500', color: tab === key ? '#1E40AF' : '#6b7280' }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'shifts' ? (
        <>
          {/* Week navigation */}
          <View className="bg-white border-b border-surface-variant">
            <View className="flex-row items-center px-4 py-2 gap-2">
              <Pressable onPress={() => setAnchor((a) => { const d = new Date(a); d.setDate(d.getDate() - 7); return d; })} className="p-2">
                <Text className="text-on-surface-variant text-lg">‹</Text>
              </Pressable>
              <Text className="flex-1 text-center text-sm font-semibold text-on-surface">
                {`${weekDates[0].getDate()}/${weekDates[0].getMonth() + 1} – ${weekDates[6].getDate()}/${weekDates[6].getMonth() + 1}/${weekDates[6].getFullYear()}`}
              </Text>
              <Pressable onPress={() => setAnchor((a) => { const d = new Date(a); d.setDate(d.getDate() + 7); return d; })} className="p-2">
                <Text className="text-on-surface-variant text-lg">›</Text>
              </Pressable>
            </View>

            {/* Day pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}>
              {weekDates.map((d, i) => {
                const isToday = toISO(d) === toISO(new Date());
                const sel = i === selectedIdx;
                const count = assignments.filter((a) => a.work_date === toISO(d)).length;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setSelectedIdx(i)}
                    style={{
                      alignItems: 'center',
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: sel ? '#1E40AF' : isToday ? '#EFF6FF' : '#f3f4f6',
                      minWidth: 52,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '600', color: sel ? '#bfdbfe' : '#9ca3af', textTransform: 'uppercase' }}>
                      {DOW_SHORT[i]}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: sel ? '#fff' : isToday ? '#1E40AF' : '#374151' }}>
                      {d.getDate()}
                    </Text>
                    {count > 0 && (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sel ? '#93c5fd' : '#1E40AF', marginTop: 2 }} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Shift templates */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">Ca làm việc</Text>
              <Pressable
                onPress={() => setShiftModal(true)}
                className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-primary"
              >
                <Text className="text-white text-sm font-bold">+ Tạo ca</Text>
              </Pressable>
            </View>

            {shifts.length === 0 && (
              <View className="items-center py-8 mb-4">
                <Text className="text-4xl mb-2">🗓</Text>
                <Text className="text-on-surface-variant text-sm">Chưa có ca làm việc nào</Text>
              </View>
            )}

            {shifts.map((shift) => {
              const shiftAssigns = dayAssignments.filter((a) => a.work_shifts.id === shift.id);
              return (
                <View key={shift.id} className="bg-white rounded-2xl mb-3 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeftWidth: 4, borderLeftColor: shift.color }}>
                  <View className="p-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <View>
                        <Text className="font-bold text-on-surface text-base">{shift.name}</Text>
                        <Text className="text-xs text-on-surface-variant">{shift.start_time} – {shift.end_time}</Text>
                      </View>
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() => { setAssignModal(shift); setSelectedUsers([]); }}
                          style={{ backgroundColor: shift.color + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                        >
                          <Text style={{ color: shift.color, fontSize: 13, fontWeight: '700' }}>+ Thêm</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => deleteShiftMut.mutate(shift.id)}
                          style={{ padding: 6 }}
                        >
                          <Text className="text-on-surface-variant text-base">🗑</Text>
                        </Pressable>
                      </View>
                    </View>

                    {shiftAssigns.length > 0 ? (
                      <View className="flex-row flex-wrap gap-2 mt-1">
                        {shiftAssigns.map((a) => (
                          <Pressable
                            key={a.id}
                            onPress={() => removeAssignMut.mutate(a.id)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 }}
                          >
                            <Initials name={a.users.full_name} size={20} color={shift.color} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>{a.users.full_name.split(' ').pop()}</Text>
                            <Text style={{ fontSize: 10, color: '#9ca3af' }}>✕</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <Text className="text-xs text-on-surface-variant italic mt-1">Chưa có nhân viên</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : (
        <>
          {/* Leave filter pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 12 }}>
            {([['', 'Tất cả'], ['pending', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['rejected', 'Từ chối']] as const).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setLeaveFilter(key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 99,
                  backgroundColor: leaveFilter === key ? '#1E40AF' : '#f3f4f6',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: leaveFilter === key ? '#fff' : '#6b7280' }}>
                  {label}
                  {key === '' ? ` ${leaves.length}` : ''}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {leaves.length === 0 ? (
              <View className="items-center py-16">
                <Text className="text-4xl mb-3">🏖</Text>
                <Text className="text-on-surface-variant text-sm">Không có đơn nghỉ phép nào</Text>
              </View>
            ) : (
              leaves.map((req) => (
                <LeaveCard
                  key={req.id}
                  req={req}
                  loading={reviewMut.isPending && (reviewMut.variables as any)?.id === req.id}
                  onApprove={() => reviewMut.mutate({ id: req.id, action: 'approved' })}
                  onReject={() => handleReject(req)}
                />
              ))
            )}
          </ScrollView>
        </>
      )}

      {/* ── Shift create modal ──────────────────────────────────────────────── */}
      <Modal visible={shiftModal} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/40" onPress={() => setShiftModal(false)} />
        <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
          <Text className="text-lg font-extrabold text-on-surface mb-4">Tạo ca mới</Text>

          <Text className="text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Tên ca</Text>
          <TextInput
            value={newShiftName}
            onChangeText={setNewShiftName}
            placeholder="Ví dụ: Ca sáng"
            className="bg-surface-variant rounded-xl px-4 py-3 text-on-surface mb-4"
          />

          <View className="flex-row gap-4 mb-4">
            <View className="flex-1">
              <Text className="text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Bắt đầu</Text>
              <TextInput
                value={newShiftStart}
                onChangeText={setNewShiftStart}
                placeholder="HH:MM"
                className="bg-surface-variant rounded-xl px-4 py-3 text-on-surface"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Kết thúc</Text>
              <TextInput
                value={newShiftEnd}
                onChangeText={setNewShiftEnd}
                placeholder="HH:MM"
                className="bg-surface-variant rounded-xl px-4 py-3 text-on-surface"
              />
            </View>
          </View>

          <Text className="text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Màu sắc</Text>
          <View className="flex-row gap-3 mb-6">
            {SHIFT_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setNewShiftColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: c,
                  borderWidth: newShiftColor === c ? 3 : 0,
                  borderColor: '#1E40AF',
                }}
              />
            ))}
          </View>

          <Pressable
            onPress={() => createShiftMut.mutate()}
            disabled={!newShiftName.trim() || createShiftMut.isPending}
            className="bg-primary rounded-2xl py-4 items-center"
            style={{ opacity: !newShiftName.trim() ? 0.5 : 1 }}
          >
            {createShiftMut.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white font-bold text-base">Tạo ca</Text>
            }
          </Pressable>
        </View>
      </Modal>

      {/* ── Assign staff modal ──────────────────────────────────────────────── */}
      <Modal visible={!!assignModal} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/40" onPress={() => setAssignModal(null)} />
        <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10" style={{ maxHeight: '75%' }}>
          <Text className="text-lg font-extrabold text-on-surface mb-1">Phân ca nhân viên</Text>
          {assignModal && (
            <Text className="text-sm text-on-surface-variant mb-4">
              {assignModal.name} · {selectedDate.getDate()}/{selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}
            </Text>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {staffList.map((s) => {
              const assigned = alreadyAssigned.has(s.id);
              const toggled = selectedUsers.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    if (assigned) return;
                    setSelectedUsers((prev) =>
                      prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                    );
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
                    opacity: assigned ? 0.5 : 1,
                  }}
                >
                  <Initials name={s.full_name} size={36} color={assignModal?.color ?? '#3B82F6'} />
                  <View className="flex-1">
                    <Text className="font-semibold text-on-surface">{s.full_name}</Text>
                    <Text className="text-xs text-on-surface-variant">{s.email}</Text>
                  </View>
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: assigned ? '#d1fae5' : toggled ? '#1E40AF' : '#f3f4f6',
                    borderWidth: 2, borderColor: assigned ? '#10b981' : toggled ? '#1E40AF' : '#d1d5db',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {(assigned || toggled) && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => assignMut.mutate()}
            disabled={selectedUsers.filter((id) => !alreadyAssigned.has(id)).length === 0 || assignMut.isPending}
            className="bg-primary rounded-2xl py-4 items-center mt-4"
            style={{ opacity: selectedUsers.filter((id) => !alreadyAssigned.has(id)).length === 0 ? 0.5 : 1 }}
          >
            {assignMut.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white font-bold text-base">
                  Xác nhận ({selectedUsers.filter((id) => !alreadyAssigned.has(id)).length} người)
                </Text>
            }
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
