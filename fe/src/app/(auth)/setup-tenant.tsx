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
      Alert.alert('Lỗi', 'Vui lòng nhập tên workspace');
      return;
    }
    if (!token) {
      Alert.alert('Lỗi', 'Phiên đăng nhập không hợp lệ, vui lòng thử lại');
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
          ? 'Tên miền đã được sử dụng, vui lòng chọn tên khác'
          : code === 'INVALID_TOKEN'
            ? 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại'
            : 'Không thể tạo workspace, vui lòng thử lại';
      Alert.alert('Lỗi', message);
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
          Thiết lập Workspace
        </Text>
        <Text className="text-sm text-on-surface-variant mt-2 text-center">
          Tạo workspace cho doanh nghiệp của bạn
        </Text>
      </View>

      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant px-1">
            Tên Workspace *
          </Text>
          <TextInput
            className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
            placeholder="Ví dụ: Công ty ABC"
            placeholderTextColor="#737685"
            value={tenantName}
            onChangeText={setTenantName}
            editable={!loading}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant px-1">
            Tên miền (tùy chọn)
          </Text>
          <TextInput
            className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
            placeholder="cong-ty-abc (tự động nếu để trống)"
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
            <Text className="text-on-primary font-bold text-base">Tạo Workspace</Text>
          )}
        </Pressable>

        <Pressable
          onPress={async () => { await logout(); router.replace('/(auth)/login'); }}
          disabled={loading}
          className="w-full h-12 items-center justify-center active:opacity-60"
        >
          <Text className="text-sm text-on-surface-variant">Đăng xuất và dùng tài khoản khác</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
