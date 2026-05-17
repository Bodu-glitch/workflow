import { useEffect, useRef, useState } from 'react';
import { Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text, Pressable, ScrollView, TextInput } from '@/tw';
import { useAuth } from '@/context/auth';
import { ApiError } from '@/lib/api/client';
import { staffApi } from '@/lib/api/staff';
import type { TenantOption, WorkspaceApplication, WorkspaceSearchResult } from '@/types/api';

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

export default function SelectTenantScreen() {
  const { pendingSelection, selectTenant, logout, token } = useAuth();
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Search & apply state
  const [searchQuery, setSearchQuery] = useState('');
  const [allWorkspaces, setAllWorkspaces] = useState<WorkspaceSearchResult[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // My applications state
  const [myApplications, setMyApplications] = useState<WorkspaceApplication[]>([]);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const autoEnteringRef = useRef(false);

  // Pending invitations count
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  useEffect(() => {
    if (!pendingSelection) {
      router.replace(token ? '/' : '/(auth)/login');
    }
  }, [pendingSelection, token, router]);

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

  // Load all workspaces, applications and invitations on mount
  useEffect(() => {
    if (!token) return;
    staffApi.searchWorkspaces('')
      .then(res => setAllWorkspaces(res.data as any))
      .catch(() => {})
      .finally(() => setLoadingWorkspaces(false));
    staffApi.myApplications()
      .then(res => setMyApplications(res.data as any))
      .catch(() => {});
    staffApi.myInvitations()
      .then(res => setPendingInviteCount(res.data.filter(i => i.status === 'pending').length))
      .catch(() => {});
  }, [token]);

  // Auto-enter when an approved application is detected — but only if the user is NOT already
  // a member of that workspace. On subsequent logins the membership is already in
  // pendingSelection.tenants, so we skip auto-enter and let the user click manually.
  useEffect(() => {
    if (autoEnteringRef.current) return;
    const approved = myApplications.find(a => a.status === 'approved');
    if (!approved) return;
    const alreadyMember = pendingSelection?.tenants.some(t => t.id === approved.tenants.id);
    if (alreadyMember) return;
    autoEnteringRef.current = true;
    selectTenant('', approved.tenants.id).catch(async (e) => {
      autoEnteringRef.current = false;
      if (e instanceof ApiError && e.status === 401) {
        await logout();
        router.replace('/(auth)/login');
      }
    });
  }, [myApplications, pendingSelection, selectTenant, logout, router]);

  // Poll every 5 seconds while there are pending applications
  const hasPendingApps = myApplications.some(a => a.status === 'pending');
  useEffect(() => {
    if (!hasPendingApps || !token) return;
    let isRunning = false;
    const interval = setInterval(async () => {
      if (isRunning) return;
      isRunning = true;
      try {
        const res = await staffApi.myApplications();
        setMyApplications(res.data as any);
      } catch {}
      isRunning = false;
    }, 5000);
    return () => clearInterval(interval);
  }, [hasPendingApps, token]);

  // Filter workspaces locally: exclude member workspaces, then apply search query
  const memberIds = new Set(pendingSelection?.tenants.map(t => t.id) ?? []);
  const searchResults = (searchQuery.trim().length === 0
    ? allWorkspaces
    : allWorkspaces.filter(ws =>
        ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ws.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
  ).filter(ws => !memberIds.has(ws.id));

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
          } catch {
            Alert.alert('Lỗi', 'Không thể rút đơn');
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

  if (!pendingSelection) return null;

  const pendingApps = myApplications.filter(a => a.status === 'pending');
  const historyApps = myApplications.filter(a => a.status === 'rejected' || a.status === 'withdrawn');

  return (
    <View className="flex-1 bg-surface">
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

        {/* Workspace list with filter */}
        <View className="gap-3">
          <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Ứng tuyển vào workspace
          </Text>
          <TextInput
            className="h-11 px-4 bg-surface-container-high rounded-xl text-on-surface text-sm"
            placeholder="Lọc theo tên hoặc slug..."
            placeholderTextColor="#737685"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />

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
                  <View
                    key={ws.id}
                    className="bg-surface-container-lowest rounded-xl p-4 flex-row items-center gap-3"
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-on-surface">{ws.name}</Text>
                      <Text className="text-xs text-on-surface-variant">{ws.slug}</Text>
                    </View>
                    {alreadyApplied ? (
                      <View className="px-3 py-1.5 rounded-lg bg-warning-container">
                        <Text className="text-xs font-bold text-on-warning-container">Đã ứng tuyển</Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleApply(ws)}
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
        <Pressable onPress={async () => { await logout(); router.replace('/(auth)/login'); }} className="items-center py-3 active:opacity-70">
          <Text className="text-sm font-semibold text-on-surface-variant">Đăng xuất</Text>
        </Pressable>
      </View>
    </View>
  );
}
