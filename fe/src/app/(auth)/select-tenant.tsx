import { useEffect, useRef, useState } from 'react';
import { Alert, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { useAuth } from '@/context/auth';
import { ApiError } from '@/lib/api/client';
import { authApi } from '@/lib/api/auth';
import type { TenantOption } from '@/types/api';

const SESSION_DURATION = 300;

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function RoleBadge({ role }: { role: TenantOption['role'] }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    business_owner: { label: 'Owner',      bg: 'bg-secondary-container',        text: 'text-on-secondary-container' },
    operator:       { label: 'Operator',   bg: 'bg-surface-container-high',     text: 'text-on-surface-variant' },
    staff:          { label: 'Staff',      bg: 'bg-success-container',           text: 'text-on-success-container' },
    superadmin:     { label: 'Superadmin', bg: 'bg-error-container',             text: 'text-on-error-container' },
  };
  const { label, bg, text } = config[role] ?? config.staff;
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
  const [secondsLeft, setSecondsLeft] = useState(SESSION_DURATION);
  const [newTenantName, setNewTenantName] = useState('');
  const [creating, setCreating] = useState(false);
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    if (!pendingSelection) {
      router.replace(token ? '/' : '/(auth)/login');
    }
  }, [pendingSelection, token, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStart.current) / 1000);
      const left = SESSION_DURATION - elapsed;
      if (left <= 0) {
        clearInterval(interval);
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
        ]);
      } else {
        setSecondsLeft(left);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [logout, router]);

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

  async function handleCreate() {
    if (!newTenantName.trim() || !pendingSelection) return;
    setCreating(true);
    try {
      const { data } = await authApi.createTenant({ tenant_name: newTenantName.trim() });
      await selectTenant(pendingSelection.userId, data.tenant.id);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to create workspace.';
      Alert.alert('Error', message);
    } finally {
      setCreating(false);
    }
  }

  async function handleBack() {
    await logout();
    router.replace('/(auth)/login');
  }

  if (!pendingSelection) return null;

  return (
    <View className="flex-1 bg-surface">
      {/* Glass header */}
      <View className="glass-effect px-6 pt-14 pb-4 flex-row items-center justify-between">
        <Text className="text-xl font-extrabold text-primary tracking-tight">Executive Kinetic</Text>
        <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Session: {formatTime(secondsLeft)}
          </Text>
        </View>
      </View>

      {/* Title */}
      <View className="px-6 pt-8 pb-6">
        <Text className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          {pendingSelection.tenants.length === 0 ? 'Create Workspace' : 'Select Workspace'}
        </Text>
        <Text className="text-on-surface-variant">
          {pendingSelection.tenants.length === 0
            ? 'Set up your workspace to get started.'
            : 'Welcome back. Choose an organization to continue your session.'}
        </Text>
      </View>

      {/* Warning */}
      {secondsLeft < 60 && (
        <View className="mx-6 mb-4 px-4 py-3 bg-warning-container rounded-xl">
          <Text className="text-sm font-semibold text-on-warning-container">
            Session expires in {secondsLeft} seconds
          </Text>
        </View>
      )}

      <ScrollView className="flex-1 px-6" contentContainerClassName="gap-4 pb-6">
        {pendingSelection.tenants.map((tenant) => (
          <Pressable
            key={tenant.id}
            onPress={() => handleSelect(tenant)}
            disabled={loadingId !== null || creating}
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
              {loadingId === tenant.id && (
                <ActivityIndicator size="small" color="#003d9b" />
              )}
            </View>
          </Pressable>
        ))}

        {/* Create new workspace */}
        <View className="mt-2 pt-4 border-t border-outline-variant gap-3">
          <Text className="text-sm font-semibold text-on-surface-variant">
            {pendingSelection.tenants.length === 0
              ? 'No workspaces yet. Create one to get started.'
              : 'Or create a new workspace'}
          </Text>
          <TextInput
            className="w-full h-12 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
            placeholder="Workspace name"
            placeholderTextColor="#737685"
            value={newTenantName}
            onChangeText={setNewTenantName}
            editable={!creating && loadingId === null}
          />
          <Pressable
            onPress={handleCreate}
            disabled={!newTenantName.trim() || creating || loadingId !== null}
            className="h-12 bg-primary rounded-xl items-center justify-center active:opacity-80 disabled:opacity-40"
          >
            {creating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-on-primary font-bold">Create Workspace</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <View className="px-6 pb-10 pt-2">
        <Pressable onPress={handleBack} className="items-center py-3 active:opacity-70">
          <Text className="text-sm font-semibold text-on-surface-variant">Back to Login</Text>
        </Pressable>
      </View>
    </View>
  );
}
