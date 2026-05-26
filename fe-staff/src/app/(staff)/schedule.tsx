import React, { useState, useMemo } from 'react';
import { ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, Pressable, TextInput } from '@/tw';
import { scheduleApi } from '@/lib/api/schedule';
import type { MyShiftAssignment, LeaveRequest, LeaveType } from '@/types/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekDates(anchor: Date) {
  const day = anchor.getDay();
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

const DOW_VN = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
const DOW_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: 'Nghỉ phép năm',
  sick: 'Nghỉ bệnh',
  personal: 'Việc riêng',
  other: 'Khác',
};
const LEAVE_TYPE_OPTIONS: [LeaveType, string][] = [
  ['annual', 'Nghỉ phép năm'],
  ['sick', 'Nghỉ bệnh'],
  ['personal', 'Việc riêng'],
  ['other', 'Khác'],
];

const LEAVE_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: 'Chờ duyệt', bg: '#fef3c7', color: '#92400e' },
  approved: { label: 'Đã duyệt',  bg: '#dcfce7', color: '#15803d' },
  rejected: { label: 'Từ chối',   bg: '#fee2e2', color: '#dc2626' },
};

function fmtDateVN(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function dateDiffDays(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;
}

// ─── Shift icon by time ───────────────────────────────────────────────────────
function shiftIcon(startTime: string) {
  const hour = parseInt(startTime.split(':')[0], 10);
  if (hour < 10) return '🌅';
  if (hour < 14) return '☀️';
  if (hour < 18) return '🌤';
  return '🌙';
}

// ─── My Schedule Tab ─────────────────────────────────────────────────────────
function MyScheduleTab() {
  const [anchor, setAnchor] = useState(new Date());
  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);
  const fromISO = toISO(weekDates[0]);
  const toISO2 = toISO(weekDates[6]);

  const { data, isLoading } = useQuery({
    queryKey: ['my-assignments', fromISO, toISO2],
    queryFn: () => scheduleApi.myAssignments(fromISO, toISO2),
    select: (d) => d.data,
  });
  const assignments: MyShiftAssignment[] = data ?? [];

  // Group by date
  const byDate = useMemo(() => {
    const map = new Map<string, MyShiftAssignment[]>();
    for (const a of assignments) {
      const list = map.get(a.work_date) ?? [];
      list.push(a);
      map.set(a.work_date, list);
    }
    return map;
  }, [assignments]);

  const today = toISO(new Date());

  return (
    <>
      {/* Week navigation */}
      <View className="bg-white border-b border-surface-variant">
        <View className="flex-row items-center px-4 py-2 gap-2">
          <Pressable
            onPress={() => setAnchor((a) => { const d = new Date(a); d.setDate(d.getDate() - 7); return d; })}
            className="p-2 active:opacity-60"
          >
            <Text className="text-on-surface-variant text-lg">‹</Text>
          </Pressable>
          <Text className="flex-1 text-center text-sm font-semibold text-on-surface">
            {`Tuần ${weekDates[0].getDate()}/${weekDates[0].getMonth() + 1} – ${weekDates[6].getDate()}/${weekDates[6].getMonth() + 1}`}
          </Text>
          <Pressable
            onPress={() => setAnchor((a) => { const d = new Date(a); d.setDate(d.getDate() + 7); return d; })}
            className="p-2 active:opacity-60"
          >
            <Text className="text-on-surface-variant text-lg">›</Text>
          </Pressable>
        </View>

        {/* Day strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}>
          {weekDates.map((d, i) => {
            const iso = toISO(d);
            const isToday = iso === today;
            const hasShift = byDate.has(iso);
            return (
              <View
                key={i}
                style={{
                  alignItems: 'center',
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  backgroundColor: isToday ? '#1E40AF' : '#f3f4f6',
                  minWidth: 48,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '600', color: isToday ? '#bfdbfe' : '#9ca3af', textTransform: 'uppercase' }}>
                  {DOW_SHORT[i]}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: isToday ? '#fff' : '#374151' }}>
                  {d.getDate()}
                </Text>
                {hasShift && (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isToday ? '#93c5fd' : '#1E40AF', marginTop: 2 }} />
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} color="#1E40AF" />}

        {!isLoading && assignments.length === 0 && (
          <View className="items-center py-20">
            <Text className="text-5xl mb-3">🗓</Text>
            <Text className="text-on-surface font-bold text-base mb-1">Tuần này chưa có ca</Text>
            <Text className="text-on-surface-variant text-sm text-center">
              Bạn chưa được phân ca trong tuần này
            </Text>
          </View>
        )}

        {weekDates.map((d, i) => {
          const iso = toISO(d);
          const dayShifts = byDate.get(iso) ?? [];
          if (dayShifts.length === 0) return null;
          const isToday = iso === today;

          return (
            <View key={iso} className="mb-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Text className="font-bold text-on-surface text-sm">{DOW_VN[i]}</Text>
                <Text className="text-xs text-on-surface-variant">{d.getDate()}/{d.getMonth() + 1}</Text>
                {isToday && (
                  <View className="bg-primary rounded-full px-2 py-0.5">
                    <Text className="text-white text-xs font-bold">Hôm nay</Text>
                  </View>
                )}
              </View>
              {dayShifts.map((a) => {
                const shift = a.work_shifts;
                return (
                  <View
                    key={a.id}
                    className="bg-white rounded-2xl mb-2 p-4 flex-row items-center gap-4"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeftWidth: 4, borderLeftColor: shift.color } as any}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: shift.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20 }}>{shiftIcon(shift.start_time)}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-on-surface">{shift.name}</Text>
                      <Text className="text-sm text-on-surface-variant">{shift.start_time} – {shift.end_time}</Text>
                      {a.note ? <Text className="text-xs text-on-surface-variant italic mt-0.5">{a.note}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

// ─── Leave Requests Tab ───────────────────────────────────────────────────────
function LeaveRequestsTab() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-leave-requests'],
    queryFn: () => scheduleApi.myLeaveRequests(),
    select: (d) => d.data,
  });
  const requests: LeaveRequest[] = data ?? [];

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  // ── Create modal ──────────────────────────────────────────────────────────
  const [modal, setModal] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const createMut = useMutation({
    mutationFn: () =>
      scheduleApi.createLeaveRequest({
        type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
      Alert.alert('Đã gửi đơn', 'Đơn nghỉ phép đang chờ duyệt');
      setModal(false);
      setStartDate('');
      setEndDate('');
      setReason('');
    },
    onError: (e: any) => Alert.alert('Lỗi', e.message ?? 'Lỗi không xác định'),
  });

  return (
    <>
      {/* CTA bar */}
      <View className="px-4 py-3 bg-white border-b border-surface-variant flex-row items-center justify-between">
        <Text className="text-sm text-on-surface-variant">
          {pendingCount > 0 ? `${pendingCount} đơn đang chờ duyệt` : 'Không có đơn chờ duyệt'}
        </Text>
        <Pressable
          onPress={() => setModal(true)}
          className="flex-row items-center gap-1 px-4 py-2 rounded-full bg-primary active:opacity-80"
        >
          <Text className="text-white text-sm font-bold">+ Đăng ký nghỉ</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} color="#1E40AF" />}

        {!isLoading && requests.length === 0 && (
          <View className="items-center py-20">
            <Text className="text-5xl mb-3">🏖</Text>
            <Text className="text-on-surface font-bold text-base mb-1">Chưa có đơn nghỉ phép</Text>
            <Text className="text-on-surface-variant text-sm">Nhấn "Đăng ký nghỉ" để gửi đơn</Text>
          </View>
        )}

        {requests.map((req) => {
          const cfg = LEAVE_STATUS_CONFIG[req.status] ?? LEAVE_STATUS_CONFIG.pending;
          const days = dateDiffDays(req.start_date, req.end_date);
          return (
            <View key={req.id} className="bg-white rounded-2xl mb-3 p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' } as any}>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="font-bold text-on-surface text-base">{LEAVE_TYPE_LABEL[req.type]}</Text>
                <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
                </View>
              </View>
              <Text className="text-sm text-on-surface-variant mb-1">
                📅 {fmtDateVN(req.start_date)} – {fmtDateVN(req.end_date)} ({days} ngày)
              </Text>
              {req.reason ? (
                <Text className="text-sm text-on-surface mt-1">{req.reason}</Text>
              ) : null}
              {req.reject_reason ? (
                <View className="bg-red-50 rounded-xl p-3 mt-2">
                  <Text className="text-xs text-red-500 mb-0.5">Lý do từ chối</Text>
                  <Text className="text-sm text-red-700">{req.reject_reason}</Text>
                </View>
              ) : null}
              <Text className="text-xs text-on-surface-variant mt-2">
                Gửi lúc {new Date(req.created_at).toLocaleDateString('vi-VN')}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Create modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setModal(false)} />
        <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
          <Text className="text-lg font-extrabold text-on-surface mb-4">Đăng ký nghỉ phép</Text>

          <Text className="text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wide">Loại nghỉ</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {LEAVE_TYPE_OPTIONS.map(([val, label]) => (
              <Pressable
                key={val}
                onPress={() => setLeaveType(val)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 99,
                  backgroundColor: leaveType === val ? '#1E40AF' : '#f3f4f6',
                }}
                className="active:opacity-80"
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: leaveType === val ? '#fff' : '#6b7280' }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row gap-4 mb-4">
            <View className="flex-1">
              <Text className="text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Từ ngày</Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder={today}
                placeholderTextColor="#9ca3af"
                className="bg-surface-variant rounded-xl px-4 py-3 text-on-surface"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">Đến ngày</Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder={today}
                placeholderTextColor="#9ca3af"
                className="bg-surface-variant rounded-xl px-4 py-3 text-on-surface"
              />
            </View>
          </View>

          <Text className="text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">
            Lý do (tuỳ chọn)
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Nhập lý do nghỉ phép..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            className="bg-surface-variant rounded-xl px-4 py-3 text-on-surface mb-6"
            style={{ textAlignVertical: 'top', minHeight: 80 }}
          />

          <Pressable
            onPress={() => createMut.mutate()}
            disabled={!startDate || !endDate || createMut.isPending}
            className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
            style={{ opacity: !startDate || !endDate ? 0.5 : 1 }}
          >
            {createMut.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white font-bold text-base">Gửi đơn</Text>
            }
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StaffScheduleScreen() {
  const [tab, setTab] = useState<'schedule' | 'leave'>('schedule');

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-5 pt-12 pb-3 bg-white">
        <Text className="text-2xl font-extrabold text-on-surface">Lịch làm việc</Text>
        <View className="flex-row gap-1 mt-4 bg-surface-variant rounded-xl p-1">
          {([['schedule', 'Lịch của tôi'], ['leave', 'Nghỉ phép']] as const).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              className="flex-1 py-2 rounded-lg items-center active:opacity-80"
              style={{ backgroundColor: tab === key ? '#fff' : 'transparent' }}
            >
              <Text style={{ fontSize: 13, fontWeight: tab === key ? '700' : '500', color: tab === key ? '#1E40AF' : '#6b7280' }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'schedule' ? <MyScheduleTab /> : <LeaveRequestsTab />}
    </View>
  );
}
