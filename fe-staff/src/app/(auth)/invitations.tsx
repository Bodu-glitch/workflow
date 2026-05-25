import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { useAuth } from '@/context/auth';
import { staffApi } from '@/lib/api/staff';
import type { InAppInvitation } from '@/types/api';

function RoleBadge({ role }: { role: InAppInvitation['role'] }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    business_owner: { label: 'Owner',      bg: 'bg-secondary-container',    text: 'text-on-secondary-container' },
    operator:       { label: 'Operator',   bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
    staff:          { label: 'Staff',      bg: 'bg-success-container',       text: 'text-on-success-container' },
    superadmin:     { label: 'Superadmin', bg: 'bg-error-container',         text: 'text-on-error-container' },
  };
  const { label, bg, text } = config[role] ?? config.staff;
  return (
    <View className={`self-start px-2.5 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${text}`}>{label}</Text>
    </View>
  );
}

function formatExpiry(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return dateStr; }
}

export default function InvitationsScreen() {
  const { refreshProfile, selectTenant } = useAuth();
  const router = useRouter();
  const [invitations, setInvitations] = useState<InAppInvitation[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(false);

  const fetchInvitations = useCallback(async () => {
    setFetching(true);
    setError(false);
    try {
      const res = await staffApi.myInvitations();
      setInvitations(res.data.filter(i => i.status === 'pending'));
    } catch { setError(true); }
    finally { setFetching(false); }
  }, []);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  async function navigateForward() {
    await refreshProfile();
    router.replace('/');
  }

  function removeInvitation(id: string) {
    setInvitations(prev => prev.filter(i => i.id !== id));
  }

  async function handleAccept(id: string, tenantId: string) {
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      await staffApi.acceptInvitation(id);
      // selectTenant sets X-Tenant-ID, re-fetches profile, and clears pendingSelection
      await selectTenant('', tenantId);
      router.replace('/');
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không thể chấp nhận lời mời.');
      setLoadingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function handleDecline(id: string) {
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      await staffApi.declineInvitation(id);
      removeInvitation(id);
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không thể từ chối lời mời.');
    } finally {
      setLoadingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  if (fetching) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color="#003d9b" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-surface px-6">
        <Text className="text-base text-on-surface text-center mb-6">
          Không thể tải lời mời. Vui lòng thử lại.
        </Text>
        <Pressable onPress={fetchInvitations} className="kinetic-gradient px-8 py-3 rounded-xl active:opacity-80">
          <Text className="text-on-primary font-bold">Thử lại</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(auth)/select-tenant')} className="mt-4 py-2 active:opacity-70">
          <Text className="text-sm text-on-surface-variant">Tìm workspace khác</Text>
        </Pressable>
      </View>
    );
  }

  // Empty state — all invitations declined/accepted
  if (!fetching && invitations.length === 0) {
    return (
      <View className="flex-1 bg-surface">
        {/* Header with back button */}
        <View className="px-6 pt-14 pb-4 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.replace('/(auth)/select-tenant')}
            className="w-9 h-9 items-center justify-center rounded-xl bg-surface-container active:opacity-60"
          >
            <Text className="text-on-surface text-base">←</Text>
          </Pressable>
          <Text className="text-xl font-bold text-on-surface">Lời mời</Text>
        </View>

        <View className="flex-1 items-center justify-center px-8 gap-5">
          <Text className="text-4xl">✉️</Text>
          <View className="items-center gap-2">
            <Text className="text-base font-bold text-on-surface text-center">
              Không còn lời mời nào
            </Text>
            <Text className="text-sm text-on-surface-variant text-center leading-relaxed">
              Bạn đã xử lý hết lời mời. Hãy tìm workspace để ứng tuyển hoặc chờ lời mời mới.
            </Text>
          </View>
          <Pressable
            onPress={() => router.replace('/(auth)/select-tenant')}
            className="w-full h-12 items-center justify-center rounded-xl bg-primary active:opacity-80"
          >
            <Text className="text-sm font-bold text-on-primary">Tìm workspace</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Header with back button */}
      <View className="px-6 pt-14 pb-4 flex-row items-center gap-3">
        <Pressable
          onPress={() => router.replace('/(auth)/select-tenant')}
          className="w-9 h-9 items-center justify-center rounded-xl bg-surface-container active:opacity-60"
        >
          <Text className="text-on-surface text-base">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold text-on-surface">Lời mời</Text>
          <Text className="text-xs text-on-surface-variant mt-0.5">
            {invitations.length} lời mời đang chờ phản hồi
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-6" contentContainerClassName="gap-4 pb-6">
        {invitations.map((inv) => {
          const isLoading = loadingIds.has(inv.id);
          return (
            <View key={inv.id} className="bg-surface-container-lowest rounded-xl p-5">
              <View className="gap-2 mb-4">
                <View className="flex-row items-start justify-between">
                  <Text className="text-base font-bold text-on-surface flex-1 mr-2">
                    {inv.tenants.name}
                  </Text>
                  <RoleBadge role={inv.role} />
                </View>
                <Text className="text-xs text-on-surface-variant">
                  Hết hạn: {formatExpiry(inv.expires_at)}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => handleDecline(inv.id)}
                  disabled={isLoading}
                  className="flex-1 bg-surface-container-high rounded-xl py-3 items-center active:opacity-70 disabled:opacity-40"
                >
                  <Text className="text-sm font-semibold text-on-surface-variant">Từ chối</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAccept(inv.id, inv.tenant_id)}
                  disabled={isLoading}
                  className="flex-1 kinetic-gradient rounded-xl py-3 items-center active:opacity-80 disabled:opacity-40"
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-sm font-bold text-on-primary">Chấp nhận</Text>
                  )}
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View className="px-6 pb-10 pt-2">
        <Pressable
          onPress={() => router.replace('/(auth)/select-tenant')}
          className="items-center py-3 active:opacity-70"
        >
          <Text className="text-sm font-semibold text-on-surface-variant">← Quay lại tìm workspace</Text>
        </Pressable>
      </View>
    </View>
  );
}
