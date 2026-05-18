import { useState } from 'react';
import { Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, Pressable, ScrollView } from '@/tw';
import { useAuth } from '@/context/auth';
import { authApi } from '@/lib/api/auth';
import { tenantStore } from '@/lib/api/client';
import { router } from 'expo-router';
import type { UserProfile, TenantOption } from '@/types/api';

export default function SetupTenantScreen() {
  const { token, selectTenant, logout } = useAuth();
  const router = useRouter();
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!tenantName.trim()) {
      Alert.alert('Error', 'Please enter a workspace name');
      return;
    }
    if (!token) {
      Alert.alert('Error', 'Invalid session, please try again');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authApi.completeGoogleOnboarding(
        token,
        tenantName.trim(),
        tenantSlug.trim() || undefined,
      );
      await tenantStore.set(data.tenant.id);
      // selectTenant re-fetches profile and clears needsOnboarding via setState
      await selectTenant('', data.tenant.id);
      router.replace('/');
    } catch (e: any) {
      const code = e?.code ?? e?.error?.code;
      const message =
        code === 'SLUG_ALREADY_EXISTS'
          ? 'This slug is already taken, please choose another'
          : code === 'INVALID_TOKEN'
            ? 'Session expired, please log in again'
            : 'Unable to create workspace, please try again';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="flex-grow justify-center px-6 py-12"
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center mb-10">
        <View className="w-16 h-16 rounded-xl bg-primary items-center justify-center mb-6 shadow-sm">
          <Text className="text-on-primary text-3xl font-black">T</Text>
        </View>
        <Text className="text-2xl font-extrabold text-on-surface tracking-tight">
          Set Up Workspace
        </Text>
        <Text className="text-sm text-on-surface-variant mt-2 text-center">
          Create a workspace for your business
        </Text>
      </View>

      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant px-1">
            Workspace Name *
          </Text>
          <TextInput
            className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
            placeholder="E.g. ABC Company"
            placeholderTextColor="#737685"
            value={tenantName}
            onChangeText={setTenantName}
            editable={!loading}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant px-1">
            Slug (optional)
          </Text>
          <TextInput
            className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
            placeholder="abc-company (auto-generated if empty)"
            placeholderTextColor="#737685"
            value={tenantSlug}
            onChangeText={setTenantSlug}
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="kinetic-gradient w-full h-14 rounded-xl items-center justify-center shadow-sm active:opacity-90 disabled:opacity-50 mt-2"
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-on-primary font-bold text-base">Create Workspace</Text>
          )}
        </Pressable>

        <Pressable
          onPress={async () => { await logout(); router.replace('/(auth)/login'); }}
          disabled={loading}
          className="w-full h-12 items-center justify-center active:opacity-60"
        >
          <Text className="text-sm text-on-surface-variant">Sign out and use a different account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
