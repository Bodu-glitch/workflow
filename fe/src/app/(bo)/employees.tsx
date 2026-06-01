import { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Image, Modal, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, TextInput, Pressable, ScrollView } from '@/tw';
import { staffApi } from '@/lib/api/staff';
import { meApi } from '@/lib/api/me';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorView } from '@/components/ui/ErrorView';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api/client';
import { useToast } from '@/context/toast';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import type { StaffMember, StaffDisplayStatus, WorkspaceApplication, ViolationNote } from '@/types/api';

type Tab = 'staff' | 'invitations' | 'applications';
type StatusFilter = 'all' | StaffDisplayStatus;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDisplayStatus(s: StaffMember): StaffDisplayStatus {
  if (!s.is_active) return 'locked';
  if (s.online_status === 'working') return 'working';
  if (s.online_status === 'online') return 'online';
  return 'offline';
}

const STATUS_CONFIG: Record<StaffDisplayStatus, {
  label: string; dot: string; bg: string; color: string; icon: string;
}> = {
  online:  { label: 'Online',    dot: '#16a34a', bg: '#dcfce7', color: '#15803d', icon: '🟢' },
  working: { label: 'Đang làm', dot: '#2563eb', bg: '#dbeafe', color: '#1d4ed8', icon: '🔵' },
  offline: { label: 'Offline',   dot: '#9ca3af', bg: '#f3f4f6', color: '#6b7280', icon: '⚪' },
  locked:  { label: 'Bị khóa',  dot: '#dc2626', bg: '#fee2e2', color: '#dc2626', icon: '🔒' },
};

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',     label: 'Tất cả' },
  { key: 'online',  label: '🟢 Online' },
  { key: 'working', label: '🔵 Đang làm' },
  { key: 'offline', label: '⚪ Offline' },
  { key: 'locked',  label: '🔒 Bị khóa' },
];

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: StaffDisplayStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.bg }}>
      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
      <Text className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}

// ── Violation Notes Modal ─────────────────────────────────────────────────────
function ViolationNotesModal({
  staff,
  visible,
  onClose,
}: {
  staff: StaffMember | null;
  visible: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [newNote, setNewNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['violations', staff?.id],
    queryFn: () => staffApi.listViolations(staff!.id),
    enabled: !!staff && visible,
    select: (d) => d.data,
  });
  const notes: ViolationNote[] = data ?? [];

  const addMut = useMutation({
    mutationFn: () => staffApi.addViolation(staff!.id, newNote.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['violations', staff?.id] });
      setNewNote('');
      showToast('Đã thêm ghi chú vi phạm.', 'success', 'Thành công');
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Lỗi', 'error', 'Lỗi'),
  });

  const deleteMut = useMutation({
    mutationFn: (noteId: string) => staffApi.deleteViolation(staff!.id, noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['violations', staff?.id] });
      showToast('Đã xóa ghi chú.', 'info');
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Lỗi', 'error', 'Lỗi'),
  });

  function handleClose() {
    setNewNote('');
    onClose();
  }

  if (!staff) return null;

  const initials = staff.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View className="flex-1 bg-surface">
        {/* Header */}
        <View className="px-5 pt-14 pb-4 border-b border-surface-container">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-base font-bold text-on-surface">Ghi chú vi phạm</Text>
            <Pressable onPress={handleClose} className="w-10 h-10 items-center justify-center rounded-xl active:opacity-60">
              <Text className="text-on-surface-variant">✕</Text>
            </Pressable>
          </View>
          {/* Staff identity */}
          <View className="flex-row items-center gap-3 mt-2">
            <View className="w-9 h-9 rounded-xl items-center justify-center bg-primary/10">
              <Text className="text-sm font-extrabold text-primary">{initials}</Text>
            </View>
            <View>
              <Text className="text-sm font-semibold text-on-surface">{staff.full_name}</Text>
              <Text className="text-xs text-on-surface-variant">{staff.email}</Text>
            </View>
            {notes.length > 0 && (
              <View className="ml-auto px-2.5 py-1 rounded-full bg-red-100">
                <Text className="text-xs font-bold text-red-600">{notes.length} vi phạm</Text>
              </View>
            )}
          </View>
        </View>

        {/* Notes list */}
        <ScrollView className="flex-1 px-5 pt-4">
          {isLoading && (
            <View className="py-12 items-center"><ActivityIndicator color="#1E40AF" /></View>
          )}
          {!isLoading && notes.length === 0 && (
            <View className="py-16 items-center gap-2">
              <Text className="text-4xl">✅</Text>
              <Text className="text-on-surface font-semibold">Chưa có ghi chú vi phạm</Text>
              <Text className="text-xs text-on-surface-variant text-center">Nhân viên này chưa có vi phạm nào được ghi nhận.</Text>
            </View>
          )}
          {notes.map((note) => (
            <View
              key={note.id}
              className="bg-surface-container-lowest rounded-2xl p-4 mb-3"
              style={{ borderLeftWidth: 3, borderLeftColor: '#ef4444' }}
            >
              <Text className="text-sm text-on-surface leading-5 mb-2">{note.content}</Text>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-[10px] text-on-surface-variant">
                    {note.users?.full_name ?? 'Quản lý'}
                  </Text>
                  <Text className="text-[10px] text-on-surface-variant">
                    {new Date(note.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => deleteMut.mutate(note.id)}
                  disabled={deleteMut.isPending}
                  className="px-3 py-1.5 rounded-xl bg-red-50 active:opacity-70 disabled:opacity-40"
                >
                  <Text className="text-xs font-bold text-red-500">Xóa</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <View className="h-4" />
        </ScrollView>

        {/* Add note form */}
        <View className="px-5 pt-4 pb-8 border-t border-surface-container bg-white">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Thêm ghi chú vi phạm
          </Text>
          <TextInput
            value={newNote}
            onChangeText={setNewNote}
            placeholder="Mô tả hành vi vi phạm..."
            multiline
            numberOfLines={3}
            className="bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm mb-3"
            style={{ textAlignVertical: 'top', minHeight: 72 }}
          />
          <Pressable
            onPress={() => addMut.mutate()}
            disabled={!newNote.trim() || addMut.isPending}
            className="bg-primary rounded-xl py-3 items-center active:opacity-80"
            style={{ opacity: !newNote.trim() ? 0.5 : 1 }}
          >
            {addMut.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text className="text-white text-sm font-bold">Thêm ghi chú</Text>
            }
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Lock Confirm Modal (with reason input) ────────────────────────────────────
function LockModal({
  staff,
  visible,
  onCancel,
  onConfirm,
  pending,
}: {
  staff: { id: string; name: string } | null;
  visible: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');

  function handleConfirm() {
    onConfirm(reason.trim());
    setReason('');
  }
  function handleCancel() {
    setReason('');
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View className="flex-1 bg-black/50 justify-center px-5">
        <View className="bg-white rounded-2xl p-6">
          <Text className="text-base font-bold text-on-surface mb-1">Khóa tài khoản</Text>
          <Text className="text-sm text-on-surface-variant mb-4">
            Khóa tài khoản của <Text className="font-semibold text-on-surface">{staff?.name}</Text>?{'\n'}Họ sẽ không thể truy cập workspace cho đến khi được mở khóa.
          </Text>
          <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Lý do khóa (tuỳ chọn)
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Nhập lý do khóa tài khoản..."
            multiline
            numberOfLines={2}
            className="bg-surface-container rounded-xl px-4 py-3 text-on-surface text-sm mb-4"
            style={{ textAlignVertical: 'top', minHeight: 60 }}
          />
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleCancel}
              className="flex-1 py-3 rounded-xl bg-surface-container items-center active:opacity-70"
            >
              <Text className="text-sm font-semibold text-on-surface-variant">Hủy</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={pending}
              className="flex-1 py-3 rounded-xl bg-red-500 items-center active:opacity-80 disabled:opacity-50"
            >
              {pending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text className="text-sm font-bold text-white">🔒 Khóa</Text>
              }
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BOEmployeeManagementScreen() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { role, user } = useAuth();
  const isBO = role === 'business_owner';

  // ── Realtime: invitations + staff membership ──────────────────────────────
  useEffect(() => {
    const tenantId = user?.tenant_id;
    if (!tenantId) return;

    const channel = supabase
      .channel(`employees:${tenantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'invitations',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['invitations'] });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_tenants',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['staff'] });
        qc.invalidateQueries({ queryKey: ['invitations'] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workspace_applications',
      }, () => {
        qc.invalidateQueries({ queryKey: ['staff-applications'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.tenant_id, qc]);

  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['staff-applications'] });
    qc.invalidateQueries({ queryKey: ['invitations'] });
  }, [qc]));

  const [tab, setTab] = useState<Tab>('staff');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'staff' | 'operator'>('staff');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);
  const [lockTarget, setLockTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmUnlock, setConfirmUnlock] = useState<{ id: string; name: string } | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [violationTarget, setViolationTarget] = useState<StaffMember | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list(),
    select: (d) => d.data,
  });

  const invitationsQuery = useQuery({
    queryKey: ['invitations'],
    queryFn: () => staffApi.invitations(),
    select: (d) => d.data,
  });

  const applicationsQuery = useQuery({
    queryKey: ['staff-applications'],
    queryFn: () => staffApi.applications(),
    select: (d) => d.data,
    refetchOnMount: 'always',
    refetchInterval: 5000,
  });

  const staffProfileQuery = useQuery({
    queryKey: ['staff-profile', viewingProfileId],
    queryFn: () => meApi.getStaffProfile(viewingProfileId!),
    enabled: !!viewingProfileId,
    select: (d) => d.data,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const inviteMutation = useMutation({
    mutationFn: () => staffApi.invite(inviteEmail.trim(), inviteRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      setInviteEmail('');
      setShowInviteForm(false);
      showToast('Đã gửi lời mời thành công.', 'success', 'Thành công');
    },
    onError: (e) => {
      const msg =
        e instanceof ApiError && e.code === 'ALREADY_IN_WORKSPACE'
          ? 'Email này đã là thành viên trong workspace này rồi.'
          : e instanceof ApiError && e.code === 'USER_IN_OTHER_WORKSPACE'
            ? 'Người này đang là thành viên của workspace khác. Họ cần rời workspace hiện tại trước.'
            : e instanceof ApiError ? e.message : 'Không thể gửi lời mời.';
      showToast(msg, 'error', 'Lỗi');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => staffApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      showToast('Đã xóa nhân viên khỏi workspace.', 'success', 'Thành công');
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Không thể xóa nhân viên', 'error', 'Lỗi'),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => staffApi.resendInvite(id),
    onSuccess: () => showToast('Đã gửi lại lời mời.', 'success', 'Thành công'),
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Không thể gửi lại lời mời.', 'error', 'Lỗi'),
  });

  const lockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => staffApi.lock(id, reason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      showToast('Đã khóa tài khoản nhân viên.', 'success', 'Đã khóa');
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Không thể khóa nhân viên.', 'error', 'Lỗi'),
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) => staffApi.unlock(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      showToast('Đã mở khóa tài khoản nhân viên.', 'success', 'Đã mở khóa');
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Không thể mở khóa nhân viên.', 'error', 'Lỗi'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => staffApi.approveApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-applications'] });
      qc.invalidateQueries({ queryKey: ['staff'] });
      showToast('Ứng viên đã được thêm vào team.', 'success', 'Đã duyệt');
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Không thể duyệt', 'error', 'Lỗi'),
  });

  const rejectAppMutation = useMutation({
    mutationFn: (id: string) => staffApi.rejectApplication(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-applications'] }),
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Không thể từ chối', 'error', 'Lỗi'),
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const isLoading = staffQuery.isLoading || invitationsQuery.isLoading;
  const isError = staffQuery.isError || invitationsQuery.isError;

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={() => { staffQuery.refetch(); invitationsQuery.refetch(); }} />;

  const allStaff = staffQuery.data ?? [];
  const invitationList = (invitationsQuery.data ?? []).filter(inv => inv.status === 'pending');
  const applicationList: WorkspaceApplication[] = ((applicationsQuery.data as any) ?? []).filter((a: WorkspaceApplication) => a.status === 'pending');

  const statusCounts = allStaff.reduce<Record<StaffDisplayStatus, number>>(
    (acc, s) => { acc[getDisplayStatus(s)]++; return acc; },
    { online: 0, working: 0, offline: 0, locked: 0 },
  );

  const filteredStaff = statusFilter === 'all'
    ? allStaff
    : allStaff.filter(s => getDisplayStatus(s) === statusFilter);

  return (
    <>
    {/* ── Confirm remove ── */}
    <ConfirmDialog
      visible={!!confirmRemove}
      title="Xóa nhân viên"
      message={`Bạn có chắc muốn xóa ${confirmRemove?.name ?? ''} khỏi workspace này không?`}
      confirmLabel="Xóa"
      cancelLabel="Hủy"
      destructive
      onCancel={() => setConfirmRemove(null)}
      onConfirm={() => {
        if (confirmRemove) removeMutation.mutate(confirmRemove.id);
        setConfirmRemove(null);
      }}
    />

    {/* ── Confirm unlock ── */}
    <ConfirmDialog
      visible={!!confirmUnlock}
      title="Mở khóa nhân viên"
      message={`Mở khóa tài khoản của ${confirmUnlock?.name ?? ''}? Họ sẽ có thể đăng nhập và nhận task trở lại.`}
      confirmLabel="Mở khóa"
      cancelLabel="Hủy"
      onCancel={() => setConfirmUnlock(null)}
      onConfirm={() => {
        if (confirmUnlock) unlockMutation.mutate(confirmUnlock.id);
        setConfirmUnlock(null);
      }}
    />

    {/* ── Lock modal (with reason input) ── */}
    <LockModal
      staff={lockTarget}
      visible={!!lockTarget}
      pending={lockMutation.isPending}
      onCancel={() => setLockTarget(null)}
      onConfirm={(reason) => {
        if (lockTarget) lockMutation.mutate({ id: lockTarget.id, reason });
        setLockTarget(null);
      }}
    />

    {/* ── Violation Notes Modal ── */}
    <ViolationNotesModal
      staff={violationTarget}
      visible={!!violationTarget}
      onClose={() => setViolationTarget(null)}
    />

    {/* ── Staff Profile Modal ── */}
    <Modal visible={!!viewingProfileId} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setViewingProfileId(null)}>
      <View className="flex-1 bg-surface">
        <View className="px-5 pt-14 pb-4 flex-row items-center justify-between border-b border-surface-container">
          <Text className="text-base font-bold text-on-surface">Hồ sơ nhân viên</Text>
          <Pressable onPress={() => setViewingProfileId(null)} className="w-10 h-10 items-center justify-center rounded-xl active:opacity-60">
            <Text className="text-on-surface-variant text-sm">✕</Text>
          </Pressable>
        </View>
        <ScrollView className="flex-1 px-5 pt-4">
          {staffProfileQuery.isLoading && (
            <View className="py-16 items-center"><ActivityIndicator color="#1E40AF" /></View>
          )}
          {staffProfileQuery.data && (() => {
            const p = staffProfileQuery.data;
            const initials = p.full_name?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() ?? 'U';
            return (
              <View className="gap-5 pb-12">
                <View className="items-center pt-2">
                  <View className="w-20 h-20 rounded-2xl items-center justify-center" style={{ backgroundColor: '#1E40AF' }}>
                    <Text className="text-white text-2xl font-extrabold">{initials}</Text>
                  </View>
                  <Text className="text-lg font-extrabold text-on-surface mt-3">{p.full_name}</Text>
                  <Text className="text-sm text-on-surface-variant mt-0.5">{p.email}</Text>
                </View>
                <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
                  <View className="px-4 py-3 flex-row items-center gap-3 border-b border-surface-container">
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Điện thoại</Text>
                      <Text className="text-sm font-medium text-on-surface mt-0.5">{p.phone ?? 'Chưa cập nhật'}</Text>
                    </View>
                  </View>
                  <View className="px-4 py-3 flex-row items-center gap-3">
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">CCCD</Text>
                      <Text className={`text-sm font-medium mt-0.5 ${p.cccd ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {p.cccd ?? 'Chưa cập nhật'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View>
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                    Chứng chỉ ({p.certificates?.length ?? 0})
                  </Text>
                  {(p.certificates?.length ?? 0) === 0 ? (
                    <View className="bg-surface-container-lowest rounded-2xl py-8 items-center">
                      <Text className="text-on-surface-variant text-sm">Chưa có chứng chỉ nào</Text>
                    </View>
                  ) : (
                    <View className="gap-3">
                      {p.certificates.map((cert: any) => (
                        <View key={cert.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden">
                          <Image source={{ uri: cert.file_url }} style={{ width: '100%', height: 160, backgroundColor: '#e5e7eb' }} resizeMode="cover" />
                          <View className="px-4 py-3">
                            <Text className="text-sm font-semibold text-on-surface">{cert.name}</Text>
                            <Text className="text-xs text-on-surface-variant mt-0.5">{new Date(cert.uploaded_at).toLocaleDateString('vi-VN')}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          })()}
        </ScrollView>
      </View>
    </Modal>

    <View className="flex-1 bg-surface">
      {/* ── Glass Header ── */}
      <View className="glass-effect px-5 pt-14 pb-4">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="active:opacity-60">
              <Text className="text-primary font-semibold">← Quay lại</Text>
            </Pressable>
            <Text className="text-xl font-extrabold text-on-surface tracking-tight">Nhân viên</Text>
          </View>
          <Pressable
            onPress={() => setShowInviteForm((v) => !v)}
            className="kinetic-gradient rounded-xl px-4 py-2 active:opacity-80"
          >
            <Text className="text-on-primary text-sm font-bold">+ Mời</Text>
          </Pressable>
        </View>

        {/* ── Tabs ── */}
        <View className="flex-row gap-2">
          {(['staff', 'invitations', 'applications'] as Tab[]).map((t) => {
            const label =
              t === 'staff'        ? `NHÂN VIÊN (${allStaff.length})` :
              t === 'invitations'  ? `LỜI MỜI (${invitationList.length})` :
                                     `ỨNG TUYỂN (${applicationList.length})`;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-xl items-center ${tab === t ? 'kinetic-gradient' : 'bg-surface-container-highest'}`}
              >
                <Text className={`text-xs font-bold ${tab === t ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={staffQuery.isRefetching || invitationsQuery.isRefetching || applicationsQuery.isRefetching}
            onRefresh={() => { staffQuery.refetch(); invitationsQuery.refetch(); applicationsQuery.refetch(); }}
          />
        }
      >
        {/* ── Invite form ── */}
        {showInviteForm && (
          <View className="bg-surface-container-lowest rounded-2xl p-5 mb-4">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-4">
              Mời thành viên mới
            </Text>
            <TextInput
              className="w-full h-12 px-4 bg-surface-container-high rounded-xl text-on-surface text-base mb-3"
              placeholder="Địa chỉ email"
              placeholderTextColor="#737685"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View className="flex-row gap-2 mb-4">
              {(['staff', 'operator'] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setInviteRole(r)}
                  className={`flex-1 py-2.5 rounded-xl items-center ${inviteRole === r ? 'kinetic-gradient' : 'bg-surface-container-high'}`}
                >
                  <Text className={`text-xs font-bold capitalize ${inviteRole === r ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                    {r === 'staff' ? 'Nhân viên' : 'Operator'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !inviteEmail.trim()}
              className="kinetic-gradient rounded-xl py-3.5 items-center active:opacity-80 disabled:opacity-50"
            >
              {inviteMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-on-primary font-bold">Gửi lời mời</Text>
              }
            </Pressable>
          </View>
        )}

        {/* ══════════ STAFF TAB ══════════ */}
        {tab === 'staff' && (
          <>
            {/* ── Status filter pills ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1">
              <View className="flex-row gap-2 px-1 pb-1">
                {STATUS_FILTERS.map(({ key, label }) => {
                  const count = key === 'all' ? allStaff.length : statusCounts[key as StaffDisplayStatus];
                  const isActive = statusFilter === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setStatusFilter(key)}
                      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full active:opacity-70"
                      style={{
                        backgroundColor: isActive ? '#1E40AF' : '#f3f4f6',
                        borderWidth: 1,
                        borderColor: isActive ? '#1E40AF' : 'transparent',
                      }}
                    >
                      <Text className="text-xs font-semibold" style={{ color: isActive ? '#fff' : '#374151' }}>
                        {label}
                      </Text>
                      <View
                        className="px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#e5e7eb' }}
                      >
                        <Text className="text-[10px] font-bold" style={{ color: isActive ? '#fff' : '#6b7280' }}>
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* ── Empty state ── */}
            {filteredStaff.length === 0 && (
              <View className="py-16 items-center gap-2">
                <Text className="text-3xl">
                  {statusFilter === 'all' ? '👥' : STATUS_CONFIG[statusFilter as StaffDisplayStatus]?.icon ?? '🔍'}
                </Text>
                <Text className="text-on-surface-variant text-sm font-medium">
                  {statusFilter === 'all' ? 'Chưa có nhân viên nào' : `Không có nhân viên nào đang ${STATUS_CONFIG[statusFilter as StaffDisplayStatus]?.label}`}
                </Text>
              </View>
            )}

            {/* ── Staff cards ── */}
            {filteredStaff.map((s) => {
              const displayStatus = getDisplayStatus(s);
              const cfg = STATUS_CONFIG[displayStatus];
              const initials = s.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
              const isLocked = !s.is_active;

              return (
                <View
                  key={s.id}
                  className="bg-surface-container-lowest rounded-2xl px-4 py-4 mb-3"
                  style={{ opacity: isLocked ? 0.85 : 1 }}
                >
                  <View className="flex-row items-center gap-3">
                    {/* Avatar with status dot */}
                    <View className="relative">
                      <View
                        className="w-11 h-11 rounded-xl items-center justify-center"
                        style={{ backgroundColor: isLocked ? '#f3f4f6' : '#eff6ff' }}
                      >
                        <Text className="text-sm font-extrabold" style={{ color: isLocked ? '#9ca3af' : '#1E40AF' }}>
                          {initials}
                        </Text>
                      </View>
                      <View
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface-container-lowest"
                        style={{ backgroundColor: cfg.dot }}
                      />
                    </View>

                    {/* Info */}
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="text-sm font-semibold text-on-surface" numberOfLines={1}>
                          {s.full_name}
                        </Text>
                        <StatusBadge status={displayStatus} />
                      </View>
                      <Text className="text-xs text-on-surface-variant mt-0.5" numberOfLines={1}>{s.email}</Text>
                      <View className="flex-row items-center gap-2 mt-1.5 flex-wrap">
                        <View className="px-2 py-0.5 rounded-full bg-secondary-container">
                          <Text className="text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                            {s.role === 'staff' ? 'Nhân viên' : 'Operator'}
                          </Text>
                        </View>
                        {s.last_login_at && (
                          <Text className="text-[10px] text-on-surface-variant">
                            Hoạt động {new Date(s.last_login_at).toLocaleDateString('vi-VN')}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Lock reason banner */}
                  {isLocked && s.lock_reason && (
                    <View className="mt-3 px-3 py-2 bg-red-50 rounded-xl flex-row items-start gap-2">
                      <Text className="text-red-400 text-xs mt-0.5">🔒</Text>
                      <Text className="flex-1 text-xs text-red-700 leading-4">{s.lock_reason}</Text>
                    </View>
                  )}

                  {/* BO actions */}
                  {isBO && (
                    <View className="flex-row gap-2 mt-3 pt-3 border-t border-surface-container">
                      {/* Violation notes */}
                      <Pressable
                        onPress={() => setViolationTarget(s)}
                        className="px-3 py-2 rounded-xl items-center active:opacity-70 bg-orange-50"
                      >
                        <Text className="text-xs font-bold text-orange-600">⚠ Vi phạm</Text>
                      </Pressable>

                      {/* Lock / Unlock */}
                      <Pressable
                        onPress={() => isLocked
                          ? setConfirmUnlock({ id: s.id, name: s.full_name })
                          : setLockTarget({ id: s.id, name: s.full_name })
                        }
                        disabled={lockMutation.isPending || unlockMutation.isPending}
                        className="flex-1 py-2 rounded-xl items-center active:opacity-70 disabled:opacity-50"
                        style={{ backgroundColor: isLocked ? '#dcfce7' : '#fef3c7' }}
                      >
                        <Text className="text-xs font-bold" style={{ color: isLocked ? '#15803d' : '#92400e' }}>
                          {isLocked ? '🔓 Mở khóa' : '🔒 Khóa'}
                        </Text>
                      </Pressable>

                      {/* Remove */}
                      <Pressable
                        onPress={() => setConfirmRemove({ id: s.id, name: s.full_name })}
                        disabled={removeMutation.isPending}
                        className="px-4 py-2 rounded-xl items-center active:opacity-70 disabled:opacity-50 bg-error-container"
                      >
                        <Text className="text-xs font-bold text-error">Xóa</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ══════════ INVITATIONS TAB ══════════ */}
        {tab === 'invitations' && (
          <>
            {invitationList.length === 0 && (
              <View className="py-16 items-center gap-2">
                <Text className="text-3xl">📨</Text>
                <Text className="text-on-surface-variant text-sm">Không có lời mời đang chờ</Text>
              </View>
            )}
            {invitationList.map((inv) => (
              <View key={inv.id} className="bg-surface-container-lowest rounded-2xl px-4 py-4 mb-3 flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-surface-container-high items-center justify-center mr-3">
                  <Text className="text-sm font-bold text-primary">{inv.email.charAt(0).toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-on-surface">{inv.email}</Text>
                  <View className="self-start mt-1.5 px-2 py-0.5 rounded-full bg-warning-container">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-on-warning-container">{inv.status}</Text>
                  </View>
                  <Text className="text-xs text-on-surface-variant mt-1">
                    {new Date(inv.created_at).toLocaleDateString('vi-VN')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => resendMutation.mutate(inv.id)}
                  disabled={resendMutation.isPending}
                  className="active:opacity-60 ml-2"
                >
                  <Text className="text-xs font-semibold text-primary">Gửi lại</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        {/* ══════════ APPLICATIONS TAB ══════════ */}
        {tab === 'applications' && (
          <>
            {applicationList.length === 0 && (
              <View className="py-16 items-center gap-2">
                <Text className="text-3xl">📋</Text>
                <Text className="text-on-surface-variant text-sm">Chưa có đơn ứng tuyển nào</Text>
              </View>
            )}
            {applicationList.map((app) => (
              <View key={app.id} className="bg-surface-container-lowest rounded-2xl px-4 py-4 mb-3">
                <View className="flex-row items-center mb-3">
                  <View className="w-10 h-10 rounded-full bg-surface-container-high items-center justify-center mr-3">
                    <Text className="text-sm font-bold text-primary">{app.applicant.full_name.charAt(0)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-on-surface">{app.applicant.full_name}</Text>
                    <Text className="text-xs text-on-surface-variant">{app.applicant.email}</Text>
                  </View>
                  <View className={`px-2 py-0.5 rounded-full ${
                    app.status === 'pending' ? 'bg-warning-container' :
                    app.status === 'approved' ? 'bg-success-container' : 'bg-error-container'
                  }`}>
                    <Text className={`text-[10px] font-bold uppercase ${
                      app.status === 'pending' ? 'text-on-warning-container' :
                      app.status === 'approved' ? 'text-on-success-container' : 'text-on-error-container'
                    }`}>
                      {app.status === 'pending' ? 'Chờ duyệt' : app.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                    </Text>
                  </View>
                </View>
                {app.message ? <Text className="text-xs text-on-surface-variant mb-3 italic">"{app.message}"</Text> : null}
                <Text className="text-xs text-on-surface-variant mb-3">
                  {new Date(app.applied_at).toLocaleDateString('vi-VN')}
                </Text>
                <View className="flex-row gap-2 mb-2">
                  <Pressable
                    onPress={() => setViewingProfileId(app.applicant.id)}
                    className="flex-1 py-2.5 rounded-xl bg-surface-container items-center active:opacity-70"
                  >
                    <Text className="text-xs font-bold text-on-surface">Xem hồ sơ</Text>
                  </Pressable>
                </View>
                {app.status === 'pending' && (
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => approveMutation.mutate(app.id)}
                      disabled={approveMutation.isPending || rejectAppMutation.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-success-container items-center active:opacity-80 disabled:opacity-50"
                    >
                      {approveMutation.isPending
                        ? <ActivityIndicator size="small" color="#1a6e3c" />
                        : <Text className="text-xs font-bold text-on-success-container">Chấp nhận</Text>
                      }
                    </Pressable>
                    <Pressable
                      onPress={() => rejectAppMutation.mutate(app.id)}
                      disabled={approveMutation.isPending || rejectAppMutation.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-error-container items-center active:opacity-80 disabled:opacity-50"
                    >
                      {rejectAppMutation.isPending
                        ? <ActivityIndicator size="small" color="#b3261e" />
                        : <Text className="text-xs font-bold text-on-error-container">Từ chối</Text>
                      }
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
    </>
  );
}
