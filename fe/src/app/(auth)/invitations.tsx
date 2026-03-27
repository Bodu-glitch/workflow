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
  const { refreshProfile } = useAuth();
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
      setInvitations(res.data.data.filter(i => i.status === 'pending'));
    } catch { setError(true); }
    finally { setFetching(false); }
  }, []);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  async function navigateForward() {
    await refreshProfile();
    router.replace('/');
  }

  function removeInvitation(id: string) {
    setInvitations(prev => {
      const next = prev.filter(i => i.id !== id);
      if (next.length === 0) setTimeout(() => navigateForward(), 0);
      return next;
    });
  }

  async function handleAccept(id: string) {
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      await staffApi.acceptInvitation(id);
      removeInvitation(id);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Cannot accept invitation.');
    } finally {
      setLoadingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function handleDecline(id: string) {
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      await staffApi.declineInvitation(id);
      removeInvitation(id);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Cannot decline invitation.');
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
          Could not load invitations. Please try again.
        </Text>
        <Pressable onPress={fetchInvitations} className="kinetic-gradient px-8 py-3 rounded-xl active:opacity-80">
          <Text className="text-on-primary font-bold">Retry</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/')} className="mt-4 py-2 active:opacity-70">
          <Text className="text-sm text-on-surface-variant">Skip</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-6 pt-14 pb-6">
        <Text className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          Pending Invitations
        </Text>
        <Text className="text-sm text-on-surface-variant leading-relaxed">
          Choose which workspaces you would like to join.
        </Text>
      </View>

      <ScrollView className="flex-1 px-6" contentContainerClassName="gap-5 pb-6">
        {invitations.map((inv) => {
          const isLoading = loadingIds.has(inv.id);
          return (
            <View key={inv.id} className="bg-surface-container-lowest rounded-xl p-6">
              <View className="gap-3 mb-5">
                <View className="flex-row items-start justify-between">
                  <Text className="text-lg font-bold text-on-surface flex-1 mr-2">
                    {inv.tenants.name}
                  </Text>
                  <RoleBadge role={inv.role} />
                </View>
                <Text className="text-xs text-on-surface-variant">
                  Expires: {formatExpiry(inv.expires_at)}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => handleDecline(inv.id)}
                  disabled={isLoading}
                  className="flex-1 bg-surface-container-high rounded-xl py-3 items-center active:opacity-70 disabled:opacity-40"
                >
                  <Text className="text-sm font-semibold text-on-surface-variant">Decline</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAccept(inv.id)}
                  disabled={isLoading}
                  className="flex-1 kinetic-gradient rounded-xl py-3 items-center active:opacity-80 disabled:opacity-40"
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-sm font-bold text-on-primary">Accept</Text>
                  )}
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View className="px-6 pb-10 pt-2">
        <Pressable onPress={() => router.replace('/')} className="items-center py-3 active:opacity-70">
          <Text className="text-sm font-semibold text-on-surface-variant">Skip, enter app</Text>
        </Pressable>
      </View>
    </View>
  );
}
