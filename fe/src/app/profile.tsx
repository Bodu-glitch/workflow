import { useState, useEffect } from 'react';
import { ActivityIndicator, Image, Modal, Pressable as RNPressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, ScrollView, Text, TextInput, View } from '@/tw';
import { Image as TwImage } from '@/tw/image';
import { useAuth } from '@/context/auth';
import { meApi } from '@/lib/api/me';
import { workspaceApi } from '@/lib/api/workspace';
import { useToast } from '@/context/toast';
import { supabase } from '@/lib/supabase';

const ROLE_LABELS: Record<string, string> = {
  business_owner: 'Business Owner',
  operator: 'Operator',
  staff: 'Field Staff',
  superadmin: 'Super Admin',
};

type TenantStatus = 'active' | 'inactive' | 'suspended' | 'pending';

const STATUS_CONFIG: Record<TenantStatus, {
  label: string;
  color: string;
  badgeBg: string;
  bannerBg: string;
  icon: string;
  bannerMsg: string;
}> = {
  active: {
    label: 'Đang hoạt động',
    color: '#16a34a',
    badgeBg: '#dcfce7',
    bannerBg: '#f0fdf4',
    icon: '✅',
    bannerMsg: 'Workspace đang hoạt động bình thường.',
  },
  pending: {
    label: 'Chờ duyệt',
    color: '#d97706',
    badgeBg: '#fef3c7',
    bannerBg: '#fffbeb',
    icon: '⏳',
    bannerMsg: 'Workspace đang chờ quản trị hệ thống phê duyệt. Một số tính năng có thể bị hạn chế.',
  },
  inactive: {
    label: 'Tạm dừng',
    color: '#6b7280',
    badgeBg: '#f3f4f6',
    bannerBg: '#f9fafb',
    icon: '⏸️',
    bannerMsg: 'Workspace đã tạm dừng hoạt động. Vui lòng liên hệ quản trị để kích hoạt lại.',
  },
  suspended: {
    label: 'Tạm dừng',
    color: '#dc2626',
    badgeBg: '#fee2e2',
    bannerBg: '#fff1f2',
    icon: '🚫',
    bannerMsg: 'Workspace bị đình chỉ. Vui lòng liên hệ quản trị hệ thống để được hỗ trợ.',
  },
};

const BO_SELECTABLE_STATUSES: TenantStatus[] = ['active', 'inactive', 'pending'];

function StatusSelector({
  current,
  onSelect,
  loading,
}: {
  current: TenantStatus;
  onSelect: (s: 'active' | 'inactive' | 'pending') => void;
  loading: boolean;
}) {
  return (
    <View className="flex-row gap-2 ml-11">
      {BO_SELECTABLE_STATUSES.map((s) => {
        const cfg = STATUS_CONFIG[s];
        const isActive = current === s;
        return (
          <Pressable
            key={s}
            onPress={() => !isActive && !loading && onSelect(s as 'active' | 'inactive' | 'pending')}
            disabled={isActive || loading}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full active:opacity-70 disabled:opacity-60"
            style={{
              backgroundColor: isActive ? cfg.badgeBg : '#f3f4f6',
              borderWidth: 1.5,
              borderColor: isActive ? cfg.color : 'transparent',
            }}
          >
            {loading && isActive ? (
              <ActivityIndicator size="small" color={cfg.color} style={{ width: 10, height: 10 }} />
            ) : (
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? cfg.color : '#9ca3af' }} />
            )}
            <Text
              className="text-xs font-semibold"
              style={{ color: isActive ? cfg.color : '#6b7280' }}
            >
              {cfg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function formatVND(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000)     return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)         return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toLocaleString('vi-VN');
}

function StarBar({ score, count, total }: { score: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-xs text-on-surface-variant w-3">{score}</Text>
      <Text style={{ fontSize: 10 }}>★</Text>
      <View className="flex-1 h-1.5 rounded-full bg-surface-container overflow-hidden">
        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#f59e0b' }} />
      </View>
      <Text className="text-xs text-on-surface-variant w-5 text-right">{count}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout, switchTenant, leaveCurrentWorkspace, role } = useAuth();
  const qc = useQueryClient();
  const { showToast } = useToast();

  useEffect(() => {
    const userId = user?.id;
    const tenantId = user?.tenant_id;
    if (!userId) return;
    const channel = supabase
      .channel(`profile:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ['me-profile'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tenants', filter: `id=eq.${tenantId}` }, () => {
        qc.invalidateQueries({ queryKey: ['workspace-profile'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, user?.tenant_id, qc]);

  const isBO = role === 'business_owner';
  const isOT = role === 'operator';
  const isStaff = role === 'staff';
  // OT and Staff share the same extended profile (CCCD, certificates, leave workspace)
  const isExtended = isOT || isStaff;

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cccd, setCccd] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [certPromptVisible, setCertPromptVisible] = useState(false);
  const [certPromptName, setCertPromptName] = useState('');
  const [pendingCertAsset, setPendingCertAsset] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [leaveVisible, setLeaveVisible] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaving, setLeaving] = useState(false);

  // ── Workspace profile state (BO edit, OT read-only) ──────────────────────
  const [wsEditing, setWsEditing] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsDescription, setWsDescription] = useState('');
  const [wsIndustry, setWsIndustry] = useState('');
  const [wsOperatingArea, setWsOperatingArea] = useState('');
  const [wsBenefits, setWsBenefits] = useState('');
  const [wsIncomeLevel, setWsIncomeLevel] = useState('');
  const [wsPolicies, setWsPolicies] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // ── Service categories state (BO edit, OT read-only) ─────────────────────
  const [svcEditing, setSvcEditing] = useState(false);
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());

  // ── Payment info state (BO only) ──────────────────────────────────────────
  const [payEditing, setPayEditing] = useState(false);
  const [payBankCode, setPayBankCode] = useState('');
  const [payAccountNumber, setPayAccountNumber] = useState('');
  const [payAccountName, setPayAccountName] = useState('');

  const profileQuery = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => meApi.getProfile(),
    select: d => d.data,
  });

  const profile = profileQuery.data;

  const workspaceQuery = useQuery({
    queryKey: ['workspace-profile'],
    queryFn: () => workspaceApi.getProfile(),
    select: d => d.data,
    enabled: isBO || isOT,
  });

  const ws = workspaceQuery.data;

  const statsQuery = useQuery({
    queryKey: ['workspace-stats'],
    queryFn: () => workspaceApi.getStats(),
    select: d => d.data,
    enabled: isBO || isOT,
  });
  const stats = statsQuery.data;

  const wsUpdateMutation = useMutation({
    mutationFn: () => workspaceApi.updateProfile({
      name: wsName,
      description: wsDescription,
      industry: wsIndustry,
      operating_area: wsOperatingArea,
      benefits: wsBenefits,
      income_level: wsIncomeLevel,
      policies: wsPolicies,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-profile'] });
      setWsEditing(false);
      showToast('Đã cập nhật thông tin workspace.', 'success', 'Thành công');
    },
    onError: () => showToast('Không thể cập nhật workspace.', 'error', 'Lỗi'),
  });

  // ── Service categories queries ────────────────────────────────────────────
  const allCatsQuery = useQuery({
    queryKey: ['platform-categories'],
    queryFn: () => workspaceApi.listAllCategories(),
    select: d => d.data,
    enabled: isBO || isOT,
  });

  const selectedCatsQuery = useQuery({
    queryKey: ['workspace-service-categories'],
    queryFn: () => workspaceApi.getServiceCategories(),
    select: d => d.data,
    enabled: isBO || isOT,
  });

  const svcMutation = useMutation({
    mutationFn: () => workspaceApi.setServiceCategories([...selectedCatIds]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-service-categories'] });
      setSvcEditing(false);
      showToast('Đã cập nhật dịch vụ cung cấp.', 'success', 'Thành công');
    },
    onError: () => showToast('Không thể cập nhật dịch vụ.', 'error', 'Lỗi'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: 'active' | 'inactive' | 'pending') => workspaceApi.updateStatus(status),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace-profile'] });
      const cfg = STATUS_CONFIG[(res as any).data?.status as TenantStatus] ?? STATUS_CONFIG.inactive;
      showToast(`Đã chuyển sang "${cfg.label}".`, 'success', 'Cập nhật trạng thái');
    },
    onError: () => showToast('Không thể đổi trạng thái. Vui lòng thử lại.', 'error', 'Lỗi'),
  });

  const paymentQuery = useQuery({
    queryKey: ['workspace-payment'],
    queryFn: () => workspaceApi.getPaymentInfo(),
    enabled: isBO || isOT,
  });

  const payMutation = useMutation({
    mutationFn: () => workspaceApi.updatePaymentInfo({
      bank_code: payBankCode.trim().toUpperCase(),
      account_number: payAccountNumber.trim(),
      account_name: payAccountName.trim().toUpperCase(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace-payment'] });
      setPayEditing(false);
      showToast('Đã lưu thông tin thanh toán.', 'success', 'Thành công');
    },
    onError: () => showToast('Không thể lưu thông tin thanh toán.', 'error', 'Lỗi'),
  });

  function startPayEdit() {
    const p = (paymentQuery.data as any) ?? null;
    setPayBankCode(p?.bank_code ?? '');
    setPayAccountNumber(p?.account_number ?? '');
    setPayAccountName(p?.account_name ?? '');
    setPayEditing(true);
  }

  function startSvcEdit() {
    setSelectedCatIds(new Set((selectedCatsQuery.data ?? []).map((c: any) => c.id)));
    setSvcEditing(true);
  }

  function toggleCat(id: string) {
    setSelectedCatIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startWsEdit() {
    setWsName(ws?.name ?? '');
    setWsDescription(ws?.description ?? '');
    setWsIndustry(ws?.industry ?? '');
    setWsOperatingArea(ws?.operating_area ?? '');
    setWsBenefits(ws?.benefits ?? '');
    setWsIncomeLevel(ws?.income_level ?? '');
    setWsPolicies(ws?.policies ?? '');
    setWsEditing(true);
  }

  async function pickAndUploadLogo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingLogo(true);
    try {
      await workspaceApi.updateLogo({
        uri: asset.uri,
        name: asset.fileName ?? 'logo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      qc.invalidateQueries({ queryKey: ['workspace-profile'] });
      showToast('Đã cập nhật logo workspace.', 'success', 'Thành công');
    } catch {
      showToast('Không thể tải logo lên.', 'error', 'Lỗi');
    } finally {
      setUploadingLogo(false);
    }
  }

  const updateMutation = useMutation({
    mutationFn: () => meApi.updateProfile({
      full_name: fullName,
      phone,
      cccd: isExtended ? cccd : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me-profile'] });
      setEditing(false);
      showToast('Đã cập nhật hồ sơ.', 'success', 'Thành công');
    },
    onError: () => showToast('Không thể cập nhật hồ sơ.', 'error', 'Lỗi'),
  });

  const deleteCertMutation = useMutation({
    mutationFn: (id: string) => meApi.deleteCertificate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me-profile'] }),
    onError: () => showToast('Không thể xóa chứng chỉ.', 'error', 'Lỗi'),
  });

  function startEdit() {
    setFullName(profile?.full_name ?? user?.full_name ?? '');
    setPhone(profile?.phone ?? '');
    setCccd(profile?.cccd ?? '');
    setEditing(true);
  }

  async function pickAndUploadAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      await meApi.updateAvatar({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      qc.invalidateQueries({ queryKey: ['me-profile'] });
    } catch {
      showToast('Không thể cập nhật ảnh đại diện.', 'error', 'Lỗi');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function pickAndUploadCert() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingCertAsset({ uri: asset.uri, name: asset.fileName ?? 'certificate.jpg', type: asset.mimeType ?? 'image/jpeg' });
    setCertPromptName('');
    setCertPromptVisible(true);
  }

  async function confirmUploadCert() {
    if (!pendingCertAsset || !certPromptName.trim()) return;
    setCertPromptVisible(false);
    setUploadingCert(true);
    try {
      await meApi.uploadCertificate(pendingCertAsset, certPromptName.trim());
      qc.invalidateQueries({ queryKey: ['me-profile'] });
      showToast('Đã tải chứng chỉ lên.', 'success', 'Thành công');
    } catch {
      showToast('Không thể tải chứng chỉ.', 'error', 'Lỗi');
    } finally {
      setUploadingCert(false);
      setPendingCertAsset(null);
    }
  }

  async function confirmLeave() {
    setLeaving(true);
    try {
      await meApi.leaveWorkspace(leaveReason.trim() || undefined);
      setLeaveVisible(false);
      setLeaveReason('');
      await leaveCurrentWorkspace();
    } catch {
      showToast('Không thể rời workspace. Vui lòng thử lại.', 'error', 'Lỗi');
    } finally {
      setLeaving(false);
    }
  }

  const initials =
    (profile?.full_name ?? user?.full_name)
      ?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() ?? 'U';

  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '—';
  const currentTenant = (user as any)?.tenants?.find((t: any) => t.id === user?.tenant_id);
  const workspaceName = currentTenant?.name ?? '—';

  return (
    <>
    {/* Certificate name prompt */}
    <Modal visible={certPromptVisible} transparent animationType="fade" onRequestClose={() => setCertPromptVisible(false)}>
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View className="bg-surface rounded-2xl p-6 mx-6 w-full max-w-sm gap-4">
          <Text className="text-base font-bold text-on-surface">Tên chứng chỉ</Text>
          <TextInput
            className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
            value={certPromptName}
            onChangeText={setCertPromptName}
            placeholder="VD: Chứng chỉ hàn"
            placeholderTextColor="#737685"
            autoFocus
          />
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => { setCertPromptVisible(false); setPendingCertAsset(null); }}
              className="flex-1 py-3 rounded-xl bg-surface-container items-center active:opacity-70"
            >
              <Text className="text-sm font-semibold text-on-surface">Hủy</Text>
            </Pressable>
            <Pressable
              onPress={confirmUploadCert}
              disabled={!certPromptName.trim()}
              className="flex-1 py-3 rounded-xl kinetic-gradient items-center active:opacity-80 disabled:opacity-50"
            >
              <Text className="text-sm font-bold text-on-primary">OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    {/* Leave workspace modal — OT / Staff only */}
    <Modal visible={leaveVisible} transparent animationType="fade" onRequestClose={() => setLeaveVisible(false)}>
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View className="bg-surface rounded-2xl p-6 mx-6 w-full max-w-sm gap-4">
          <View>
            <Text className="text-base font-bold text-on-surface">Rời workspace</Text>
            <Text className="text-xs text-on-surface-variant mt-1">
              Bạn sẽ bị xóa khỏi "{workspaceName}". Bạn có thể ứng tuyển lại sau.
            </Text>
          </View>
          <View>
            <Text className="text-xs text-on-surface-variant mb-1">Lý do rời (tùy chọn)</Text>
            <TextInput
              className="px-3 py-3 bg-surface-container rounded-xl text-on-surface text-sm"
              value={leaveReason}
              onChangeText={setLeaveReason}
              placeholder="Nhập lý do của bạn..."
              placeholderTextColor="#737685"
              multiline
              numberOfLines={3}
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
          </View>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => { setLeaveVisible(false); setLeaveReason(''); }}
              disabled={leaving}
              className="flex-1 py-3 rounded-xl bg-surface-container items-center active:opacity-70"
            >
              <Text className="text-sm font-semibold text-on-surface">Hủy</Text>
            </Pressable>
            <Pressable
              onPress={confirmLeave}
              disabled={leaving}
              className="flex-1 py-3 rounded-xl bg-error-container items-center active:opacity-80 disabled:opacity-50"
            >
              {leaving
                ? <ActivityIndicator size="small" color="#b3261e" />
                : <Text className="text-sm font-bold text-error">Rời workspace</Text>
              }
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    <ScrollView className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-5 pt-14 pb-4 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-xl active:opacity-60">
          <Text className="text-on-surface text-xl">←</Text>
        </Pressable>
        <Text className="text-base font-bold text-on-surface">Hồ sơ</Text>
        {!editing ? (
          <Pressable onPress={startEdit} className="w-10 h-10 items-center justify-center rounded-xl active:opacity-60">
            <Text className="text-primary text-sm font-bold">Sửa</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setEditing(false)} className="w-10 h-10 items-center justify-center active:opacity-60">
            <Text className="text-on-surface-variant text-sm">Hủy</Text>
          </Pressable>
        )}
      </View>

      <View className="px-5 gap-6 pb-12">
        {/* Avatar */}
        <View className="items-center pt-2">
          <Pressable onPress={pickAndUploadAvatar} disabled={uploadingAvatar} className="active:opacity-80">
            <View className="w-24 h-24 rounded-2xl overflow-hidden items-center justify-center" style={{ backgroundColor: '#1E40AF' }}>
              {profile?.avatar_url ? (
                <TwImage source={{ uri: profile.avatar_url }} className="w-24 h-24" resizeMode="cover" />
              ) : (
                <Text className="text-white text-3xl font-extrabold">{initials}</Text>
              )}
              {uploadingAvatar && (
                <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <View className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-primary items-center justify-center border-2 border-surface">
              <Text className="text-white text-xs">✎</Text>
            </View>
          </Pressable>
          <Text className="text-xl font-extrabold text-on-surface mt-5 tracking-tight">
            {profile?.full_name ?? user?.full_name ?? '—'}
          </Text>
          <Text className="text-sm text-on-surface-variant mt-0.5">{roleLabel}</Text>
        </View>

        {/* Edit form */}
        {editing ? (
          <View className="bg-surface-container-lowest rounded-2xl p-5 gap-4">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Chỉnh sửa thông tin</Text>

            <View>
              <Text className="text-xs text-on-surface-variant mb-1">Họ và tên</Text>
              <TextInput
                className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Họ và tên"
                placeholderTextColor="#737685"
              />
            </View>

            <View>
              <Text className="text-xs text-on-surface-variant mb-1">Số điện thoại</Text>
              <TextInput
                className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
                value={phone}
                onChangeText={setPhone}
                placeholder="0xxx xxx xxx"
                placeholderTextColor="#737685"
                keyboardType="phone-pad"
              />
            </View>

            {isExtended && (
              <View>
                <Text className="text-xs text-on-surface-variant mb-1">Căn cước công dân (CCCD)</Text>
                <TextInput
                  className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
                  value={cccd}
                  onChangeText={setCccd}
                  placeholder="12 chữ số"
                  placeholderTextColor="#737685"
                  keyboardType="numeric"
                  maxLength={12}
                />
              </View>
            )}

            <Pressable
              onPress={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="kinetic-gradient rounded-xl py-3 items-center active:opacity-80 disabled:opacity-50"
            >
              {updateMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-on-primary font-bold">Lưu thay đổi</Text>
              }
            </Pressable>
          </View>
        ) : (
          /* Contact info (read mode) */
          <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            <View className="px-4 py-3 flex-row items-center gap-3 border-b border-surface-container">
              <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                <Text>✉️</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Email</Text>
                <Text className="text-sm font-medium text-on-surface" numberOfLines={1}>{profile?.email ?? user?.email ?? '—'}</Text>
              </View>
            </View>

            <View className={`px-4 py-3 flex-row items-center gap-3 ${isExtended ? 'border-b border-surface-container' : ''}`}>
              <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                <Text>📞</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Điện thoại</Text>
                <Text className={`text-sm font-medium ${profile?.phone ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                  {profile?.phone ?? 'Chưa cập nhật'}
                </Text>
              </View>
            </View>

            {isExtended && (
              <View className="px-4 py-3 flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                  <Text>🪪</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">CCCD</Text>
                  <Text className={`text-sm font-medium ${profile?.cccd ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                    {profile?.cccd ?? 'Chưa cập nhật'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Certificates — OT + Staff only */}
        {isExtended && (
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Chứng chỉ ({profile?.certificates?.length ?? 0})
              </Text>
              <Pressable onPress={pickAndUploadCert} disabled={uploadingCert} className="active:opacity-60">
                {uploadingCert
                  ? <ActivityIndicator size="small" color="#1E40AF" />
                  : <Text className="text-sm font-bold text-primary">+ Thêm</Text>
                }
              </Pressable>
            </View>

            {(profile?.certificates ?? []).length === 0 ? (
              <View className="bg-surface-container-lowest rounded-2xl py-8 items-center">
                <Text className="text-on-surface-variant text-sm">Chưa có chứng chỉ nào</Text>
                <Text className="text-xs text-on-surface-variant mt-1">Thêm chứng chỉ để tăng cơ hội được duyệt</Text>
              </View>
            ) : (
              <View className="gap-3">
                {profile!.certificates.map(cert => (
                  <View key={cert.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden">
                    <RNPressable>
                      <Image
                        source={{ uri: cert.file_url }}
                        style={{ width: '100%', height: 160, backgroundColor: '#e5e7eb' }}
                        resizeMode="cover"
                      />
                    </RNPressable>
                    <View className="px-4 py-3 flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-on-surface">{cert.name}</Text>
                        <Text className="text-xs text-on-surface-variant mt-0.5">
                          {new Date(cert.uploaded_at).toLocaleDateString('vi-VN')}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => deleteCertMutation.mutate(cert.id)}
                        disabled={deleteCertMutation.isPending}
                        className="active:opacity-60 ml-3"
                      >
                        <Text className="text-xs font-semibold text-error">Xóa</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Thống kê tenant ── */}
        {(isBO || isOT) && (
          <View>
            <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Thống kê
            </Text>

            {statsQuery.isLoading ? (
              <View className="bg-surface-container-lowest rounded-2xl py-10 items-center">
                <ActivityIndicator color="#1E40AF" />
              </View>
            ) : (
              <View className="gap-3">
                {/* Row 1: Doanh thu + Số đơn */}
                <View className="flex-row gap-3">
                  {/* Doanh thu */}
                  <View className="flex-1 bg-surface-container-lowest rounded-2xl p-4">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Doanh thu
                    </Text>
                    <Text className="text-2xl font-extrabold mt-1" style={{ color: '#16a34a' }}>
                      {stats ? formatVND(stats.revenue.total) : '—'}
                    </Text>
                    <Text className="text-[10px] text-on-surface-variant mt-0.5">VNĐ • đơn hoàn thành</Text>
                  </View>

                  {/* Số đơn */}
                  <View className="flex-1 bg-surface-container-lowest rounded-2xl p-4">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Tổng đơn
                    </Text>
                    <Text className="text-2xl font-extrabold mt-1 text-on-surface">
                      {stats?.orders.total ?? '—'}
                    </Text>
                    <View className="flex-row gap-2 mt-1.5 flex-wrap">
                      {[
                        { label: 'Xong',  value: stats?.orders.completed,   color: '#16a34a' },
                        { label: 'Đang',  value: stats?.orders.in_progress, color: '#f59e0b' },
                        { label: 'Hủy',   value: stats?.orders.cancelled,   color: '#ef4444' },
                      ].map(({ label, value, color }) => (
                        <View key={label} className="flex-row items-center gap-1">
                          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          <Text className="text-[10px] font-semibold" style={{ color }}>
                            {label} {value ?? 0}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Row 2: Đánh giá */}
                <View className="bg-surface-container-lowest rounded-2xl p-4">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-3">
                    Đánh giá từ khách hàng
                  </Text>

                  {!stats || stats.rating.count === 0 ? (
                    <Text className="text-sm text-on-surface-variant">Chưa có đánh giá nào</Text>
                  ) : (
                    <View className="flex-row gap-4 items-center">
                      {/* Score big */}
                      <View className="items-center">
                        <Text className="text-4xl font-extrabold" style={{ color: '#f59e0b' }}>
                          {stats.rating.avg?.toFixed(1)}
                        </Text>
                        <View className="flex-row gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Text
                              key={s}
                              style={{ fontSize: 13, color: (stats.rating.avg ?? 0) >= s ? '#f59e0b' : '#d1d5db' }}
                            >★</Text>
                          ))}
                        </View>
                        <Text className="text-[10px] text-on-surface-variant mt-1">
                          {stats.rating.count} đánh giá
                        </Text>
                      </View>

                      {/* Bar chart */}
                      <View className="flex-1 gap-1.5">
                        {[5, 4, 3, 2, 1].map(s => (
                          <StarBar
                            key={s}
                            score={s}
                            count={stats.rating.distribution[s] ?? 0}
                            total={stats.rating.count}
                          />
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Workspace Profile — BO can edit, OT read-only ── */}
        {(isBO || isOT) && (
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Thông tin workspace
              </Text>
              {isBO && !wsEditing && (
                <Pressable onPress={startWsEdit} className="active:opacity-60">
                  <Text className="text-sm font-bold text-primary">Sửa</Text>
                </Pressable>
              )}
              {isBO && wsEditing && (
                <Pressable onPress={() => setWsEditing(false)} className="active:opacity-60">
                  <Text className="text-sm text-on-surface-variant">Hủy</Text>
                </Pressable>
              )}
            </View>

            {wsEditing ? (
              /* ── BO edit form ── */
              <View className="bg-surface-container-lowest rounded-2xl p-5 gap-4">
                {/* Logo upload */}
                <View className="items-center">
                  <Pressable onPress={pickAndUploadLogo} disabled={uploadingLogo} className="active:opacity-80">
                    <View
                      className="w-20 h-20 rounded-2xl overflow-hidden items-center justify-center border border-surface-container"
                      style={{ backgroundColor: '#eff6ff' }}
                    >
                      {ws?.logo_url ? (
                        <TwImage source={{ uri: ws.logo_url }} className="w-20 h-20" resizeMode="cover" />
                      ) : (
                        <Text className="text-3xl">🏢</Text>
                      )}
                      {uploadingLogo && (
                        <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                          <ActivityIndicator color="#fff" />
                        </View>
                      )}
                    </View>
                    <View className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-primary items-center justify-center border-2 border-surface">
                      <Text className="text-white text-[10px]">✎</Text>
                    </View>
                  </Pressable>
                  <Text className="text-xs text-on-surface-variant mt-3">Nhấn để đổi logo</Text>
                </View>

                <View>
                  <Text className="text-xs text-on-surface-variant mb-1">Tên workspace</Text>
                  <TextInput
                    className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
                    value={wsName}
                    onChangeText={setWsName}
                    placeholder="Tên công ty / tổ chức"
                    placeholderTextColor="#737685"
                  />
                </View>

                <View>
                  <Text className="text-xs text-on-surface-variant mb-1">Mô tả</Text>
                  <TextInput
                    className="px-3 py-3 bg-surface-container rounded-xl text-on-surface text-sm"
                    value={wsDescription}
                    onChangeText={setWsDescription}
                    placeholder="Mô tả ngắn về workspace..."
                    placeholderTextColor="#737685"
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 72, textAlignVertical: 'top' }}
                  />
                </View>

                <View>
                  <Text className="text-xs text-on-surface-variant mb-1">Lĩnh vực</Text>
                  <TextInput
                    className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
                    value={wsIndustry}
                    onChangeText={setWsIndustry}
                    placeholder="VD: Xây dựng, Điện, Cơ khí..."
                    placeholderTextColor="#737685"
                  />
                </View>

                <View>
                  <Text className="text-xs text-on-surface-variant mb-1">Khu vực hoạt động</Text>
                  <TextInput
                    className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
                    value={wsOperatingArea}
                    onChangeText={setWsOperatingArea}
                    placeholder="VD: TP.HCM, Hà Nội, miền Nam..."
                    placeholderTextColor="#737685"
                  />
                </View>

                <View>
                  <Text className="text-xs text-on-surface-variant mb-1">Chế độ đãi ngộ</Text>
                  <TextInput
                    className="px-3 py-3 bg-surface-container rounded-xl text-on-surface text-sm"
                    value={wsBenefits}
                    onChangeText={setWsBenefits}
                    placeholder="VD: Bảo hiểm đầy đủ, thưởng KPI, xe công ty..."
                    placeholderTextColor="#737685"
                    multiline
                    numberOfLines={2}
                    style={{ minHeight: 56, textAlignVertical: 'top' }}
                  />
                </View>

                <View>
                  <Text className="text-xs text-on-surface-variant mb-1">Mức thu nhập</Text>
                  <TextInput
                    className="h-11 px-3 bg-surface-container rounded-xl text-on-surface text-sm"
                    value={wsIncomeLevel}
                    onChangeText={setWsIncomeLevel}
                    placeholder="VD: 8–15 triệu/tháng, thỏa thuận..."
                    placeholderTextColor="#737685"
                  />
                </View>

                <View>
                  <Text className="text-xs text-on-surface-variant mb-1">Chính sách</Text>
                  <TextInput
                    className="px-3 py-3 bg-surface-container rounded-xl text-on-surface text-sm"
                    value={wsPolicies}
                    onChangeText={setWsPolicies}
                    placeholder="Quy định làm việc, nghỉ phép, thưởng phạt..."
                    placeholderTextColor="#737685"
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 72, textAlignVertical: 'top' }}
                  />
                </View>

                <Pressable
                  onPress={() => wsUpdateMutation.mutate()}
                  disabled={wsUpdateMutation.isPending || !wsName.trim()}
                  className="kinetic-gradient rounded-xl py-3 items-center active:opacity-80 disabled:opacity-50"
                >
                  {wsUpdateMutation.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text className="text-on-primary font-bold">Lưu thay đổi</Text>
                  }
                </Pressable>
              </View>
            ) : (
              /* ── Read view (BO + OT) ── */
              <View className="gap-3">
                {/* Status banner — chỉ hiện khi không phải active */}
                {ws?.status && ws.status !== 'active' && (() => {
                  const cfg = STATUS_CONFIG[ws.status];
                  return (
                    <View
                      className="flex-row items-start gap-3 rounded-2xl px-4 py-3.5"
                      style={{ backgroundColor: cfg.bannerBg }}
                    >
                      <Text style={{ fontSize: 18, lineHeight: 24 }}>{cfg.icon}</Text>
                      <View className="flex-1">
                        <Text className="text-sm font-bold" style={{ color: cfg.color }}>
                          {cfg.label}
                        </Text>
                        <Text className="text-xs mt-0.5" style={{ color: cfg.color, opacity: 0.85 }}>
                          {cfg.bannerMsg}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
                  {/* Logo + name + status badge */}
                  <View className="px-4 py-4 flex-row items-center gap-4 border-b border-surface-container">
                    <View
                      className="w-14 h-14 rounded-2xl overflow-hidden items-center justify-center"
                      style={{ backgroundColor: '#eff6ff' }}
                    >
                      {ws?.logo_url ? (
                        <TwImage source={{ uri: ws.logo_url }} className="w-14 h-14" resizeMode="cover" />
                      ) : (
                        <Text className="text-2xl">🏢</Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-bold text-on-surface" numberOfLines={1}>
                        {ws?.name ?? workspaceName}
                      </Text>
                      <Text className="text-xs text-on-surface-variant mt-0.5">
                        @{ws?.slug ?? '—'}
                      </Text>
                    </View>
                    {isOT && (
                      <View className="px-2 py-1 rounded-lg bg-surface-container">
                        <Text className="text-[10px] font-bold text-on-surface-variant">Chỉ xem</Text>
                      </View>
                    )}
                  </View>

                  {/* Trạng thái */}
                  <View className="px-4 py-3 gap-2 border-b border-surface-container">
                    <View className="flex-row items-center gap-3">
                      <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                        <Text>📊</Text>
                      </View>
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant flex-1">
                        Trạng thái
                      </Text>
                      {/* Current badge — always visible */}
                      {ws?.status && (() => {
                        const cfg = STATUS_CONFIG[ws.status] ?? STATUS_CONFIG.inactive;
                        return (
                          <View
                            className="flex-row items-center gap-1.5 px-3 py-1 rounded-full"
                            style={{ backgroundColor: cfg.badgeBg }}
                          >
                            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                            <Text className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</Text>
                          </View>
                        );
                      })()}
                    </View>

                    {/* BO: 3 nút chọn — ẩn khi bị suspended */}
                    {isBO && ws?.status !== 'suspended' && (
                      <StatusSelector
                        current={ws?.status ?? 'active'}
                        onSelect={(s) => statusMutation.mutate(s)}
                        loading={statusMutation.isPending}
                      />
                    )}

                    {/* BO bị suspended: thông báo liên hệ admin */}
                    {isBO && ws?.status === 'suspended' && (
                      <Text className="text-xs text-on-surface-variant ml-11">
                        Trạng thái này chỉ quản trị hệ thống mới có thể thay đổi.
                      </Text>
                    )}
                  </View>

                  {/* Description */}
                  <View className="px-4 py-3 flex-row items-start gap-3 border-b border-surface-container">
                    <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center mt-0.5">
                      <Text>📋</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Mô tả</Text>
                      <Text className={`text-sm mt-0.5 ${ws?.description ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {ws?.description ?? 'Chưa cập nhật'}
                      </Text>
                    </View>
                  </View>

                  {/* Industry */}
                  <View className="px-4 py-3 flex-row items-center gap-3 border-b border-surface-container">
                    <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                      <Text>🏭</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Lĩnh vực</Text>
                      <Text className={`text-sm font-medium ${ws?.industry ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {ws?.industry ?? 'Chưa cập nhật'}
                      </Text>
                    </View>
                  </View>

                  {/* Operating area */}
                  <View className="px-4 py-3 flex-row items-center gap-3 border-b border-surface-container">
                    <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                      <Text>📍</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Khu vực hoạt động</Text>
                      <Text className={`text-sm font-medium ${ws?.operating_area ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {ws?.operating_area ?? 'Chưa cập nhật'}
                      </Text>
                    </View>
                  </View>

                  {/* Benefits */}
                  <View className="px-4 py-3 flex-row items-start gap-3 border-b border-surface-container">
                    <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center mt-0.5">
                      <Text>🎁</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Chế độ đãi ngộ</Text>
                      <Text className={`text-sm mt-0.5 ${ws?.benefits ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {ws?.benefits ?? 'Chưa cập nhật'}
                      </Text>
                    </View>
                  </View>

                  {/* Income level */}
                  <View className="px-4 py-3 flex-row items-center gap-3 border-b border-surface-container">
                    <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                      <Text>💰</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Mức thu nhập</Text>
                      <Text className={`text-sm font-medium ${ws?.income_level ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {ws?.income_level ?? 'Chưa cập nhật'}
                      </Text>
                    </View>
                  </View>

                  {/* Policies */}
                  <View className="px-4 py-3 flex-row items-start gap-3">
                    <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center mt-0.5">
                      <Text>📜</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Chính sách</Text>
                      <Text className={`text-sm mt-0.5 ${ws?.policies ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {ws?.policies ?? 'Chưa cập nhật'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Dịch vụ cung cấp — BO edit, OT read-only ── */}
        {(isBO || isOT) && (
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Dịch vụ cung cấp
              </Text>
              {isBO && !svcEditing && (
                <Pressable onPress={startSvcEdit} className="active:opacity-60">
                  <Text className="text-sm font-bold text-primary">Chỉnh sửa</Text>
                </Pressable>
              )}
              {isBO && svcEditing && (
                <Pressable onPress={() => setSvcEditing(false)} className="active:opacity-60">
                  <Text className="text-sm text-on-surface-variant">Hủy</Text>
                </Pressable>
              )}
            </View>

            {svcEditing ? (
              /* ── BO: checklist toàn bộ danh mục platform ── */
              <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
                {(allCatsQuery.isLoading) ? (
                  <View className="py-10 items-center">
                    <ActivityIndicator color="#1E40AF" />
                  </View>
                ) : (allCatsQuery.data ?? []).length === 0 ? (
                  <View className="py-8 items-center">
                    <Text className="text-sm text-on-surface-variant">Chưa có danh mục nào trên platform</Text>
                  </View>
                ) : (
                  <>
                    {(allCatsQuery.data ?? []).map((cat: any, idx: number) => {
                      const checked = selectedCatIds.has(cat.id);
                      const isLast = idx === (allCatsQuery.data ?? []).length - 1;
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={() => toggleCat(cat.id)}
                          className={`px-4 py-3.5 flex-row items-center gap-3 active:opacity-70 ${isLast ? '' : 'border-b border-surface-container'}`}
                        >
                          {/* Checkbox */}
                          <View
                            className="w-5 h-5 rounded-md items-center justify-center border-2"
                            style={{
                              backgroundColor: checked ? '#1E40AF' : 'transparent',
                              borderColor: checked ? '#1E40AF' : '#c4c6d0',
                            }}
                          >
                            {checked && <Text className="text-white text-xs font-black">✓</Text>}
                          </View>

                          {/* Icon */}
                          {cat.icon_url ? (
                            <TwImage source={{ uri: cat.icon_url }} className="w-8 h-8 rounded-lg" resizeMode="cover" />
                          ) : (
                            <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                              <Text className="text-base">🔧</Text>
                            </View>
                          )}

                          {/* Text */}
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-on-surface">{cat.name}</Text>
                            {cat.description ? (
                              <Text className="text-xs text-on-surface-variant mt-0.5" numberOfLines={1}>
                                {cat.description}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}

                    <View className="px-4 py-3 border-t border-surface-container">
                      <Pressable
                        onPress={() => svcMutation.mutate()}
                        disabled={svcMutation.isPending}
                        className="kinetic-gradient rounded-xl py-3 items-center active:opacity-80 disabled:opacity-50"
                      >
                        {svcMutation.isPending
                          ? <ActivityIndicator color="#fff" />
                          : <Text className="text-on-primary font-bold">
                              Lưu ({selectedCatIds.size} dịch vụ)
                            </Text>
                        }
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : (
              /* ── Read view (BO + OT) ── */
              (() => {
                const selected = selectedCatsQuery.data ?? [];
                return selected.length === 0 ? (
                  <View className="bg-surface-container-lowest rounded-2xl py-8 items-center gap-1">
                    <Text className="text-on-surface-variant text-sm">Chưa đăng ký dịch vụ nào</Text>
                    {isBO && (
                      <Text className="text-xs text-on-surface-variant">Nhấn "Chỉnh sửa" để chọn dịch vụ</Text>
                    )}
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {selected.map((cat: any) => (
                      <View
                        key={cat.id}
                        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' }}
                      >
                        {cat.icon_url ? (
                          <TwImage source={{ uri: cat.icon_url }} className="w-4 h-4 rounded" resizeMode="cover" />
                        ) : (
                          <Text style={{ fontSize: 12 }}>🔧</Text>
                        )}
                        <Text className="text-xs font-semibold" style={{ color: '#1E40AF' }}>
                          {cat.name}
                        </Text>
                      </View>
                    ))}
                    {isOT && (
                      <View className="px-2 py-1 rounded-lg bg-surface-container self-center">
                        <Text className="text-[10px] font-bold text-on-surface-variant">Chỉ xem</Text>
                      </View>
                    )}
                  </View>
                );
              })()
            )}
          </View>
        )}

        {/* ── Payment info (BO + OT) ── */}
        {(isBO || isOT) && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                💳 Thanh toán QR
              </Text>
              {!payEditing && (
                <Pressable onPress={startPayEdit} className="px-3 py-1 rounded-lg bg-surface-container active:opacity-60">
                  <Text className="text-xs font-semibold text-primary">
                    {(paymentQuery.data as any) ? 'Chỉnh sửa' : 'Cài đặt'}
                  </Text>
                </Pressable>
              )}
            </View>

            {payEditing ? (
              <View className="bg-surface-container-lowest rounded-2xl p-4 gap-3">
                <View>
                  <Text className="text-xs font-semibold text-on-surface-variant mb-1">Mã ngân hàng (VietQR)</Text>
                  <TextInput
                    className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface"
                    placeholder="VD: VCB, TCB, MB, VTB, ACB..."
                    placeholderTextColor="#737685"
                    value={payBankCode}
                    onChangeText={(t) => setPayBankCode(t.toUpperCase())}
                    autoCapitalize="characters"
                  />
                  <Text className="text-[10px] text-on-surface-variant mt-1">
                    Xem mã tại vietqr.io/danh-sach-ngan-hang
                  </Text>
                </View>

                <View>
                  <Text className="text-xs font-semibold text-on-surface-variant mb-1">Số tài khoản</Text>
                  <TextInput
                    className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface"
                    placeholder="Nhập số tài khoản..."
                    placeholderTextColor="#737685"
                    value={payAccountNumber}
                    onChangeText={setPayAccountNumber}
                    keyboardType="numeric"
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-on-surface-variant mb-1">Tên chủ tài khoản</Text>
                  <TextInput
                    className="bg-surface-container-high rounded-xl px-4 py-3 text-sm text-on-surface"
                    placeholder="NGUYEN VAN A"
                    placeholderTextColor="#737685"
                    value={payAccountName}
                    onChangeText={(t) => setPayAccountName(t.toUpperCase())}
                    autoCapitalize="characters"
                  />
                </View>

                <View className="flex-row gap-2 mt-1">
                  <Pressable
                    onPress={() => payMutation.mutate()}
                    disabled={payMutation.isPending || !payBankCode || !payAccountNumber || !payAccountName}
                    className="flex-1 py-3 rounded-xl bg-primary items-center active:opacity-80 disabled:opacity-40"
                  >
                    {payMutation.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text className="text-white font-bold text-sm">Lưu</Text>
                    }
                  </Pressable>
                  <Pressable
                    onPress={() => setPayEditing(false)}
                    className="px-5 py-3 rounded-xl bg-surface-container items-center active:opacity-70"
                  >
                    <Text className="text-sm text-on-surface-variant">Hủy</Text>
                  </Pressable>
                </View>
              </View>
            ) : (paymentQuery.data as any) ? (
              <View className="bg-surface-container-lowest rounded-2xl p-4 gap-2">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center">
                    <Text className="text-lg">🏦</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-on-surface">
                      {(paymentQuery.data as any).bank_code} — {(paymentQuery.data as any).account_number}
                    </Text>
                    <Text className="text-xs text-on-surface-variant">
                      {(paymentQuery.data as any).account_name}
                    </Text>
                  </View>
                  <View className="px-2 py-1 rounded-lg bg-success/10">
                    <Text className="text-[10px] font-bold text-success">VietQR ✓</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="bg-surface-container-lowest rounded-2xl py-6 items-center gap-1">
                <Text className="text-2xl">💳</Text>
                <Text className="text-sm text-on-surface-variant">Chưa cài đặt thông tin thanh toán</Text>
                <Text className="text-xs text-on-surface-variant">Staff sẽ không thể hiện QR cho khách</Text>
              </View>
            )}
          </View>
        )}

        {/* Workspace */}
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Workspace</Text>
          <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            <View className="px-4 py-3 flex-row items-center gap-3 border-b border-surface-container">
              <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                <Text>🏢</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Workspace hiện tại</Text>
                <Text className="text-sm font-medium text-on-surface" numberOfLines={1}>{workspaceName}</Text>
              </View>
            </View>

            {isBO ? (
              /* BO: switch workspace */
              <Pressable onPress={switchTenant} className="px-4 py-4 flex-row items-center gap-3 active:opacity-60">
                <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                  <Text>🔄</Text>
                </View>
                <Text className="text-base font-semibold text-on-surface flex-1">Đổi hoặc tạo workspace</Text>
                <Text className="text-on-surface-variant">›</Text>
              </Pressable>
            ) : (
              /* OT + Staff: leave workspace */
              <Pressable onPress={() => setLeaveVisible(true)} className="px-4 py-4 flex-row items-center gap-3 active:opacity-60">
                <View className="w-8 h-8 rounded-lg bg-error-container items-center justify-center">
                  <Text>🚶</Text>
                </View>
                <Text className="text-base font-semibold text-error flex-1">Rời workspace</Text>
                <Text className="text-on-surface-variant">›</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Logout */}
        <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
          <Pressable
            onPress={async () => { await logout(); router.replace('/(auth)/login'); }}
            className="px-4 py-4 flex-row items-center gap-3 active:opacity-60"
          >
            <View className="w-8 h-8 rounded-lg bg-error-container items-center justify-center">
              <Text>🚪</Text>
            </View>
            <Text className="text-base font-semibold text-error flex-1">Đăng xuất</Text>
            <Text className="text-on-surface-variant">›</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
    </>
  );
}
