import { useEffect, useRef, useState } from 'react';
import { Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import { ApiError } from '@/lib/api/client';
import { staffApi } from '@/lib/api/staff';
import type { TenantOption, WorkspaceApplication, WorkspaceSearchResult } from '@/types/api';

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: TenantOption['role'] }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    business_owner: { label: 'Owner',    bg: 'bg-secondary-container',    text: 'text-on-secondary-container' },
    operator:       { label: 'Operator', bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
    staff:          { label: 'Staff',    bg: 'bg-success-container',      text: 'text-on-success-container' },
    superadmin:     { label: 'Superadmin', bg: 'bg-error-container',      text: 'text-on-error-container' },
  };
  const { label, bg, text } = config[role] ?? config.staff;
  return (
    <View className={`self-start px-2.5 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${text}`}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: WorkspaceApplication['status'] }) {
  const config = {
    pending:   { label: 'Chờ duyệt', bg: 'bg-warning-container',  text: 'text-on-warning-container' },
    approved:  { label: 'Đã duyệt',  bg: 'bg-success-container',  text: 'text-on-success-container' },
    rejected:  { label: 'Từ chối',   bg: 'bg-error-container',    text: 'text-on-error-container' },
    withdrawn: { label: 'Đã rút',    bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
  };
  const { label, bg, text } = config[status] ?? config.pending;
  return (
    <View className={`self-start px-2.5 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${text}`}>{label}</Text>
    </View>
  );
}

// ─── Workspace Detail Modal ────────────────────────────────────────────────────

interface WorkspaceDetailModalProps {
  ws: WorkspaceSearchResult | null;
  alreadyApplied: boolean;
  applyingId: string | null;
  onApply: (ws: WorkspaceSearchResult) => void;
  onClose: () => void;
}

function WorkspaceDetailModal({ ws, alreadyApplied, applyingId, onApply, onClose }: WorkspaceDetailModalProps) {
  if (!ws) return null;

  const rows: { icon: string; label: string; value?: string | null }[] = [
    { icon: '📝', label: 'Giới thiệu',     value: ws.description },
    { icon: '🏭', label: 'Lĩnh vực',       value: ws.industry },
    { icon: '📍', label: 'Khu vực',        value: ws.operating_area },
    { icon: '💰', label: 'Mức thu nhập',   value: ws.income_level },
    { icon: '🎁', label: 'Chế độ đãi ngộ', value: ws.benefits },
    { icon: '📜', label: 'Chính sách',     value: ws.policies },
  ];

  return (
    <Modal visible={!!ws} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="bg-surface rounded-t-3xl overflow-hidden" style={{ maxHeight: '85%' }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-5 pb-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-bold text-on-surface" numberOfLines={1}>{ws.name}</Text>
            <Text className="text-xs text-on-surface-variant">@{ws.slug}</Text>
          </View>
          <Pressable
            onPress={onClose}
            className="w-8 h-8 items-center justify-center rounded-full bg-surface-container active:opacity-60"
          >
            <Text className="text-on-surface-variant text-sm">✕</Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View className="h-px bg-surface-container mx-6" />

        {/* Content */}
        <ScrollView className="px-6" contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}>
          <View className="gap-4">
            {rows.map(({ icon, label, value }) => (
              value ? (
                <View key={label} className="flex-row items-start gap-3">
                  <View className="w-8 h-8 rounded-lg bg-surface-container-high items-center justify-center mt-0.5">
                    <Text style={{ fontSize: 15 }}>{icon}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      {label}
                    </Text>
                    <Text className="text-sm text-on-surface mt-0.5 leading-5">{value}</Text>
                  </View>
                </View>
              ) : null
            ))}
          </View>
        </ScrollView>

        {/* Apply button */}
        <View className="px-6 pt-3 pb-10">
          {alreadyApplied ? (
            <View className="h-12 items-center justify-center rounded-xl bg-warning-container">
              <Text className="text-sm font-bold text-on-warning-container">Đã ứng tuyển — đang chờ duyệt</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => { onApply(ws); onClose(); }}
              disabled={applyingId === ws.id}
              className="h-12 items-center justify-center rounded-xl bg-primary active:opacity-80 disabled:opacity-50"
            >
              {applyingId === ws.id
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-sm font-bold text-on-primary">Ứng tuyển vào {ws.name}</Text>
              }
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Workspace Card ────────────────────────────────────────────────────────────

interface WorkspaceCardProps {
  ws: WorkspaceSearchResult;
  alreadyApplied: boolean;
  applyingId: string | null;
  onApply: (ws: WorkspaceSearchResult) => void;
  onViewDetail: (ws: WorkspaceSearchResult) => void;
}

function WorkspaceCard({ ws, alreadyApplied, applyingId, onApply, onViewDetail }: WorkspaceCardProps) {
  return (
    <Pressable onPress={() => onViewDetail(ws)} className="bg-surface-container-lowest rounded-xl p-4 gap-2 active:opacity-80">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-sm font-semibold text-on-surface">{ws.name}</Text>
          <Text className="text-xs text-on-surface-variant">{ws.slug}</Text>
        </View>
        <View className="flex-row gap-1.5">
          <Pressable
            onPress={() => onViewDetail(ws)}
            className="px-2.5 py-1.5 rounded-lg bg-surface-container-high active:opacity-70"
          >
            <Text className="text-xs font-semibold text-on-surface-variant">Xem</Text>
          </Pressable>
          {alreadyApplied ? (
            <View className="px-3 py-1.5 rounded-lg bg-warning-container">
              <Text className="text-xs font-bold text-on-warning-container">Đã ứng tuyển</Text>
            </View>
          ) : (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onApply(ws); }}
              disabled={applyingId === ws.id}
              className="px-3 py-1.5 rounded-lg bg-primary active:opacity-80 disabled:opacity-50"
            >
              {applyingId === ws.id
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text className="text-xs font-bold text-on-primary">Ứng tuyển</Text>
              }
            </Pressable>
          )}
        </View>
      </View>

      {/* Extra info chips */}
      {(ws.industry || ws.operating_area || ws.benefits) && (
        <View className="flex-row flex-wrap gap-1.5 mt-0.5">
          {ws.industry && (
            <View className="flex-row items-center gap-1 bg-primary/10 rounded-full px-2.5 py-0.5">
              <Text className="text-[10px] text-primary font-medium">🏭 {ws.industry}</Text>
            </View>
          )}
          {ws.operating_area && (
            <View className="flex-row items-center gap-1 bg-secondary-container rounded-full px-2.5 py-0.5">
              <Text className="text-[10px] text-on-secondary-container font-medium">📍 {ws.operating_area}</Text>
            </View>
          )}
          {ws.benefits && (
            <View className="flex-row items-center gap-1 bg-success-container rounded-full px-2.5 py-0.5">
              <Text className="text-[10px] text-on-success-container font-medium">🎁 {ws.benefits}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

interface FilterValues {
  industry: string;
  area: string;
  benefits: string;
}

interface FilterPanelProps {
  visible: boolean;
  initial: FilterValues;
  onApply: (v: FilterValues) => void;
  onClose: () => void;
}

function FilterPanel({ visible, initial, onApply, onClose }: FilterPanelProps) {
  const [industry, setIndustry] = useState(initial.industry);
  const [area, setArea]         = useState(initial.area);
  const [benefits, setBenefits] = useState(initial.benefits);

  // Sync when reopened
  useEffect(() => {
    if (visible) {
      setIndustry(initial.industry);
      setArea(initial.area);
      setBenefits(initial.benefits);
    }
  }, [visible, initial.industry, initial.area, initial.benefits]);

  const hasAny = industry.trim() || area.trim() || benefits.trim();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="bg-surface rounded-t-3xl px-6 pt-5 pb-10 gap-5">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-on-surface">Lọc workspace</Text>
          <Pressable onPress={onClose} className="w-8 h-8 items-center justify-center rounded-full bg-surface-container active:opacity-60">
            <Text className="text-on-surface-variant text-sm">✕</Text>
          </Pressable>
        </View>

        {/* Lĩnh vực */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            🏭 Lĩnh vực
          </Text>
          <TextInput
            className="h-11 px-4 bg-surface-container-high rounded-xl text-on-surface text-sm"
            placeholder="Nhập lĩnh vực (VD: F&B, IT, Logistics...)"
            placeholderTextColor="#737685"
            value={industry}
            onChangeText={setIndustry}
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>

        {/* Khu vực */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            📍 Khu vực
          </Text>
          <TextInput
            className="h-11 px-4 bg-surface-container-high rounded-xl text-on-surface text-sm"
            placeholder="Nhập khu vực (VD: TP.HCM, Hà Nội...)"
            placeholderTextColor="#737685"
            value={area}
            onChangeText={setArea}
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>

        {/* Chế độ đãi ngộ */}
        <View className="gap-1.5">
          <Text className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            🎁 Chế độ đãi ngộ
          </Text>
          <TextInput
            className="h-11 px-4 bg-surface-container-high rounded-xl text-on-surface text-sm"
            placeholder="Nhập từ khóa đãi ngộ (VD: bảo hiểm, thưởng...)"
            placeholderTextColor="#737685"
            value={benefits}
            onChangeText={setBenefits}
            autoCapitalize="none"
            returnKeyType="done"
          />
        </View>

        {/* Actions */}
        <View className="flex-row gap-3 mt-1">
          {hasAny && (
            <Pressable
              onPress={() => { setIndustry(''); setArea(''); setBenefits(''); }}
              className="flex-1 h-11 items-center justify-center rounded-xl bg-surface-container active:opacity-70"
            >
              <Text className="text-sm font-semibold text-on-surface-variant">Xóa bộ lọc</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => onApply({ industry: industry.trim(), area: area.trim(), benefits: benefits.trim() })}
            className="flex-1 h-11 items-center justify-center rounded-xl bg-primary active:opacity-80"
          >
            <Text className="text-sm font-bold text-on-primary">Áp dụng</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SelectTenantScreen() {
  const { pendingSelection, selectTenant, logout, token, user } = useAuth();
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterValues>({ industry: '', area: '', benefits: '' });

  // Workspace list state
  const [allWorkspaces, setAllWorkspaces]       = useState<WorkspaceSearchResult[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [applyingId, setApplyingId]             = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceSearchResult | null>(null);

  // My applications state
  const [myApplications, setMyApplications] = useState<WorkspaceApplication[]>([]);
  const [withdrawingId, setWithdrawingId]   = useState<string | null>(null);
  const [refreshing, setRefreshing]         = useState(false);
  const autoEnteringRef = useRef(false);

  // Pending invitations count
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  useEffect(() => {
    if (!pendingSelection) {
      router.replace(token ? '/' : '/(auth)/login');
    }
  }, [pendingSelection, token, router]);

  // ── Load workspace list with current search + filters ─────────────────────

  const fetchWorkspaces = async (q: string, f: FilterValues) => {
    setLoadingWorkspaces(true);
    try {
      const res = await staffApi.searchWorkspaces(q, {
        industry: f.industry || undefined,
        area:     f.area     || undefined,
        benefits: f.benefits || undefined,
      });
      setAllWorkspaces(res.data as any);
    } catch {}
    finally { setLoadingWorkspaces(false); }
  };

  // Debounce search input by 400 ms
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => fetchWorkspaces(searchQuery, activeFilters), 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeFilters, token]);

  async function refreshApplications() {
    setRefreshing(true);
    try {
      const [appsRes, invRes] = await Promise.all([
        staffApi.myApplications(),
        staffApi.myInvitations(),
      ]);
      setMyApplications(appsRes.data as any);
      setPendingInviteCount(invRes.data.filter(i => i.status === 'pending').length);
    } catch {}
    finally { setRefreshing(false); }
  }

  // Load applications and invitations on mount
  useEffect(() => {
    if (!token) return;
    Promise.all([staffApi.myApplications(), staffApi.myInvitations()])
      .then(([appsRes, invRes]) => {
        setMyApplications(appsRes.data as any);
        setPendingInviteCount(invRes.data.filter(i => i.status === 'pending').length);
      })
      .catch(() => {});
  }, [token]);

  // Auto-enter approved application that user isn't already a member of
  useEffect(() => {
    if (autoEnteringRef.current) return;
    const approved = myApplications.find(a => a.status === 'approved');
    if (!approved) return;
    const alreadyMember = pendingSelection?.tenants.some(t => t.id === approved.tenants.id);
    if (alreadyMember) return;
    autoEnteringRef.current = true;
    selectTenant('', approved.tenants.id).catch((e) => {
      autoEnteringRef.current = false;
      if (e instanceof ApiError && e.status === 401) {
        // Stale approved application — membership was revoked (e.g. user left workspace).
        // Remove it locally so this effect doesn't re-trigger. Do NOT logout.
        setMyApplications(prev => prev.filter(a => a.id !== approved.id));
      }
    });
  }, [myApplications, pendingSelection, selectTenant, logout, router]);

  // ── Realtime: lắng nghe status thay đổi của đơn ứng tuyển ─────────────────
  const applicantId = pendingSelection?.userId;
  useEffect(() => {
    if (!applicantId) return;

    const channel = supabase
      .channel(`my-applications:${applicantId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'workspace_applications',
        filter: `applicant_id=eq.${applicantId}`,
      }, () => {
        refreshApplications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicantId]);

  // ── Realtime: lắng nghe lời mời mới gửi đến email của user ───────────────
  const userEmail = user?.email;
  useEffect(() => {
    if (!userEmail) return;

    const channel = supabase
      .channel(`select-tenant-invitations:${userEmail}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'invitations',
        filter: `email=eq.${userEmail}`,
      }, () => {
        staffApi.myInvitations()
          .then(res => setPendingInviteCount(res.data.filter(i => i.status === 'pending').length))
          .catch(() => {});
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userEmail]);

  // ── Client-side: exclude workspaces the user is already a member of ────────
  const memberIds    = new Set(pendingSelection?.tenants.map(t => t.id) ?? []);
  const searchResults = allWorkspaces.filter(ws => !memberIds.has(ws.id));

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleApply(workspace: WorkspaceSearchResult) {
    setApplyingId(workspace.id);
    try {
      await staffApi.apply(workspace.id);
      const res = await staffApi.myApplications();
      setMyApplications(res.data as any);
      Alert.alert('Đã gửi', `Đơn ứng tuyển vào "${workspace.name}" đã được gửi. Chờ quản lý xét duyệt.`);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      const msg =
        code === 'ALREADY_MEMBER' ? 'Bạn đã là thành viên của workspace này' :
        code === 'TENANT_NOT_FOUND' ? 'Workspace không tồn tại' :
        e instanceof ApiError ? e.message : 'Không thể gửi đơn ứng tuyển';
      Alert.alert('Lỗi', msg);
    } finally {
      setApplyingId(null);
    }
  }

  async function handleWithdraw(appId: string, workspaceName: string) {
    Alert.alert('Rút đơn', `Rút đơn ứng tuyển vào "${workspaceName}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Rút đơn', style: 'destructive', onPress: async () => {
          setWithdrawingId(appId);
          try {
            await staffApi.withdrawApplication(appId);
            setMyApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'withdrawn' } : a));
          } catch (e: any) {
            const msg = e?.message ?? 'Không thể rút đơn';
            console.error('[withdraw]', e);
            Alert.alert('Lỗi', msg);
          } finally {
            setWithdrawingId(null);
          }
        },
      },
    ]);
  }

  async function handleSelect(tenant: TenantOption) {
    if (!pendingSelection) return;
    setLoadingId(tenant.id);
    try {
      await selectTenant(pendingSelection.userId, tenant.id);
    } catch (e) {
      let message = e instanceof Error ? e.message : 'An error occurred.';
      if (e instanceof ApiError) {
        if (e.code === 'INVALID_SESSION') {
          Alert.alert('Session Expired', 'Please log in again.', [
            { text: 'OK', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
          ]);
          return;
        }
        message = e.code === 'FORBIDDEN' ? 'You do not have access to this workspace.' : e.message;
      }
      Alert.alert('Error', message);
    } finally {
      setLoadingId(null);
    }
  }

  function handleApplyFilters(values: FilterValues) {
    setActiveFilters(values);
    setFilterVisible(false);
  }

  if (!pendingSelection) return null;

  const pendingApps = myApplications.filter(a => a.status === 'pending');
  const historyApps = myApplications.filter(a => a.status === 'rejected' || a.status === 'withdrawn');
  const activeFilterCount = [activeFilters.industry, activeFilters.area, activeFilters.benefits].filter(Boolean).length;

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="glass-effect px-6 pt-14 pb-4 flex-row items-center justify-between">
        <Text className="text-xl font-extrabold text-primary tracking-tight">Executive Kinetic</Text>
        <Pressable onPress={() => router.push('/profile')} className="w-10 h-10 items-center justify-center rounded-xl active:opacity-60">
          <Text className="text-on-surface text-xl">👤</Text>
        </Pressable>
      </View>

      <View className="px-6 pt-8 pb-4">
        <Text className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          {pendingSelection.tenants.length === 0 ? 'Tham gia Workspace' : 'Chọn Workspace'}
        </Text>
        <Text className="text-on-surface-variant text-sm">
          {pendingSelection.tenants.length === 0
            ? 'Tìm kiếm và ứng tuyển vào workspace, hoặc chờ lời mời từ quản lý.'
            : 'Chọn workspace để tiếp tục.'}
        </Text>
      </View>

      <ScrollView className="flex-1 px-6" contentContainerClassName="gap-5 pb-8">

        {/* Pending invitations banner */}
        {pendingInviteCount > 0 && (
          <Pressable
            onPress={() => router.push('/(auth)/invitations')}
            className="bg-primary rounded-xl p-4 flex-row items-center gap-3 active:opacity-80"
          >
            <View className="flex-1">
              <Text className="text-on-primary font-bold text-sm">
                Bạn có {pendingInviteCount} lời mời đang chờ
              </Text>
              <Text className="text-on-primary/70 text-xs mt-0.5">
                Nhấn để xem và chấp nhận lời mời
              </Text>
            </View>
            <Text className="text-on-primary text-lg">→</Text>
          </Pressable>
        )}

        {/* Existing staff/operator tenants */}
        {pendingSelection.tenants.length > 0 && (
          <View className="gap-3">
            {pendingSelection.tenants.map((tenant) => (
              <Pressable
                key={tenant.id}
                onPress={() => handleSelect(tenant)}
                disabled={loadingId !== null}
                className="bg-surface-container-lowest rounded-xl p-5 active:opacity-80 disabled:opacity-60"
                style={{ borderLeftWidth: 4, borderLeftColor: '#003d9b' }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 gap-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-lg font-bold text-on-surface">{tenant.name}</Text>
                      <RoleBadge role={tenant.role} />
                    </View>
                    <Text className="text-sm text-on-surface-variant">{tenant.slug}</Text>
                  </View>
                  {loadingId === tenant.id && <ActivityIndicator size="small" color="#003d9b" />}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Pending applications */}
        {pendingApps.length > 0 && (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Đơn ứng tuyển đang chờ ({pendingApps.length})
              </Text>
              <Pressable onPress={refreshApplications} disabled={refreshing} className="active:opacity-60">
                {refreshing
                  ? <ActivityIndicator size="small" color="#737685" />
                  : <Text className="text-xs text-primary font-semibold">Làm mới</Text>
                }
              </Pressable>
            </View>
            {pendingApps.map((app) => (
              <View
                key={app.id}
                className="bg-surface-container-lowest rounded-xl p-4 flex-row items-center gap-3"
              >
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-semibold text-on-surface">{app.tenants.name}</Text>
                  <Text className="text-xs text-on-surface-variant">{app.tenants.slug}</Text>
                  <StatusBadge status={app.status} />
                </View>
                <Pressable
                  onPress={() => handleWithdraw(app.id, app.tenants.name)}
                  disabled={withdrawingId === app.id}
                  className="active:opacity-60"
                >
                  {withdrawingId === app.id
                    ? <ActivityIndicator size="small" color="#737685" />
                    : <Text className="text-xs font-semibold text-error">Rút đơn</Text>
                  }
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Workspace list with search + filter */}
        <View className="gap-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Ứng tuyển vào workspace
          </Text>

          {/* Search bar + filter button */}
          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 h-11 px-4 bg-surface-container-high rounded-xl text-on-surface text-sm"
              placeholder="Tìm theo tên hoặc slug..."
              placeholderTextColor="#737685"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            <Pressable
              onPress={() => setFilterVisible(true)}
              className={`w-11 h-11 items-center justify-center rounded-xl active:opacity-70 ${
                activeFilterCount > 0 ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <Text className={`text-base ${activeFilterCount > 0 ? 'text-on-primary' : 'text-on-surface-variant'}`}>
                ⚙️
              </Text>
            </Pressable>
          </View>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <View className="flex-row flex-wrap gap-1.5">
              {activeFilters.industry && (
                <View className="flex-row items-center gap-1.5 bg-primary/10 rounded-full pl-3 pr-1.5 py-1">
                  <Text className="text-[10px] font-medium text-primary">🏭 {activeFilters.industry}</Text>
                  <Pressable
                    onPress={() => setActiveFilters(f => ({ ...f, industry: '' }))}
                    className="w-4 h-4 items-center justify-center rounded-full bg-primary/20 active:opacity-60"
                  >
                    <Text className="text-[8px] text-primary font-bold">✕</Text>
                  </Pressable>
                </View>
              )}
              {activeFilters.area && (
                <View className="flex-row items-center gap-1.5 bg-secondary-container rounded-full pl-3 pr-1.5 py-1">
                  <Text className="text-[10px] font-medium text-on-secondary-container">📍 {activeFilters.area}</Text>
                  <Pressable
                    onPress={() => setActiveFilters(f => ({ ...f, area: '' }))}
                    className="w-4 h-4 items-center justify-center rounded-full bg-black/10 active:opacity-60"
                  >
                    <Text className="text-[8px] text-on-secondary-container font-bold">✕</Text>
                  </Pressable>
                </View>
              )}
              {activeFilters.benefits && (
                <View className="flex-row items-center gap-1.5 bg-success-container rounded-full pl-3 pr-1.5 py-1">
                  <Text className="text-[10px] font-medium text-on-success-container">🎁 {activeFilters.benefits}</Text>
                  <Pressable
                    onPress={() => setActiveFilters(f => ({ ...f, benefits: '' }))}
                    className="w-4 h-4 items-center justify-center rounded-full bg-black/10 active:opacity-60"
                  >
                    <Text className="text-[8px] text-on-success-container font-bold">✕</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {loadingWorkspaces ? (
            <ActivityIndicator size="small" color="#1E40AF" style={{ marginTop: 8 }} />
          ) : searchResults.length === 0 ? (
            <Text className="text-xs text-on-surface-variant text-center py-2">
              Không tìm thấy workspace nào
            </Text>
          ) : (
            <View className="gap-2">
              {searchResults.map((ws) => {
                const alreadyApplied = myApplications.some(
                  a => a.tenants.id === ws.id && a.status === 'pending'
                );
                return (
                  <WorkspaceCard
                    key={ws.id}
                    ws={ws}
                    alreadyApplied={alreadyApplied}
                    applyingId={applyingId}
                    onApply={handleApply}
                    onViewDetail={setSelectedWorkspace}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* Past applications (rejected/withdrawn) */}
        {historyApps.length > 0 && (
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Lịch sử ứng tuyển
            </Text>
            {historyApps.map((app) => (
              <View key={app.id} className="bg-surface-container-lowest rounded-xl p-4 flex-row items-center gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-semibold text-on-surface">{app.tenants.name}</Text>
                  <Text className="text-xs text-on-surface-variant">{app.tenants.slug}</Text>
                  <StatusBadge status={app.status} />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View className="px-6 pb-10 pt-2">
        <Pressable
          onPress={async () => { await logout(); router.replace('/(auth)/login'); }}
          className="items-center py-3 active:opacity-70"
        >
          <Text className="text-sm font-semibold text-on-surface-variant">Đăng xuất</Text>
        </Pressable>
      </View>

      {/* Filter panel (bottom sheet modal) */}
      <FilterPanel
        visible={filterVisible}
        initial={activeFilters}
        onApply={handleApplyFilters}
        onClose={() => setFilterVisible(false)}
      />

      {/* Workspace detail modal */}
      <WorkspaceDetailModal
        ws={selectedWorkspace}
        alreadyApplied={myApplications.some(
          a => a.tenants.id === selectedWorkspace?.id && a.status === 'pending'
        )}
        applyingId={applyingId}
        onApply={handleApply}
        onClose={() => setSelectedWorkspace(null)}
      />
    </View>
  );
}
