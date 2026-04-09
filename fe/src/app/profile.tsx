import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from '@/tw';
import { useAuth } from '@/context/auth';

const ROLE_LABELS: Record<string, string> = {
  business_owner: 'Business Owner',
  operator: 'Operator',
  staff: 'Field Staff',
  superadmin: 'Super Admin',
};

export default function ProfileScreen() {
  const { user, logout, switchTenant } = useAuth();

  const initials =
    user?.full_name
      ?.split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() ?? 'U';

  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '—';
  const currentTenant = (user as any)?.tenants?.find((t: any) => t.id === user?.tenant_id);
  const workspaceName = currentTenant?.name ?? '—';

  return (
    <ScrollView className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-5 pt-14 pb-4 flex-row items-center justify-between">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-xl active:opacity-60">
          <Text className="text-on-surface text-xl">←</Text>
        </Pressable>
        <Text className="text-base font-bold text-on-surface">Profile</Text>
        <View className="w-10" />
      </View>

      <View className="px-5 gap-6 pb-12">
        {/* Avatar */}
        <View className="items-center pt-2">
          <View className="relative">
            <View
              className="w-24 h-24 rounded-2xl items-center justify-center"
              style={{ backgroundColor: '#1E40AF' }}>
              <Text className="text-white text-3xl font-extrabold">{initials}</Text>
            </View>
            <View className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-surface-container-lowest border-2 border-surface items-center justify-center">
              <Text className="text-xs">✏️</Text>
            </View>
          </View>
          <Text className="text-xl font-extrabold text-on-surface mt-4 tracking-tight">
            {user?.full_name ?? '—'}
          </Text>
          <Text className="text-sm text-on-surface-variant mt-0.5">{roleLabel}</Text>
        </View>

        {/* Performance */}
        <View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Performance
            </Text>
            <Pressable className="active:opacity-60">
              <Text className="text-sm font-semibold" style={{ color: '#1E40AF' }}>
                View Stats
              </Text>
            </Pressable>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface-container-lowest rounded-2xl p-4">
              <Text className="text-2xl font-extrabold text-on-surface">98%</Text>
              <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-1">
                Efficiency
              </Text>
            </View>
            <View
              className="flex-1 rounded-2xl p-4"
              style={{ backgroundColor: '#1E40AF' }}>
              <Text className="text-2xl font-extrabold text-white">142</Text>
              <Text className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: '#bfdbfe' }}>
                Completed
              </Text>
            </View>
          </View>
        </View>

        {/* Contact Info */}
        <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
          <View className="px-4 py-3 flex-row items-center justify-between border-b border-surface-container">
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                <Text>✉️</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Email
                </Text>
                <Text className="text-sm font-medium text-on-surface" numberOfLines={1}>
                  {user?.email ?? '—'}
                </Text>
              </View>
            </View>
            <Pressable className="w-8 h-8 items-center justify-center active:opacity-60">
              <Text className="text-on-surface-variant">⎘</Text>
            </Pressable>
          </View>

          <View className="px-4 py-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                <Text>📞</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Mobile
                </Text>
                <Text
                  className={`text-sm font-medium ${user?.phone ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                  {user?.phone ?? '—'}
                </Text>
              </View>
            </View>
            {user?.phone && (
              <Pressable className="w-8 h-8 items-center justify-center active:opacity-60">
                <Text className="text-on-surface-variant">📲</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Workspace */}
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Workspace
          </Text>
          <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            <View className="px-4 py-3 flex-row items-center gap-3 border-b border-surface-container">
              <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                <Text>🏢</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Current Workspace
                </Text>
                <Text className="text-sm font-medium text-on-surface" numberOfLines={1}>
                  {workspaceName}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={switchTenant}
              className="px-4 py-4 flex-row items-center gap-3 active:opacity-60">
              <View className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center">
                <Text>🔄</Text>
              </View>
              <Text className="text-base font-semibold text-on-surface flex-1">Đổi hoặc tạo workspace</Text>
              <Text className="text-on-surface-variant">›</Text>
            </Pressable>
          </View>
        </View>

        {/* Settings */}
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Settings
          </Text>
          <View className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            <Pressable
              onPress={async () => { await logout(); router.replace('/(auth)/login'); }}
              className="px-4 py-4 flex-row items-center gap-3 active:opacity-60">
              <View className="w-8 h-8 rounded-lg bg-error-container items-center justify-center">
                <Text>🚪</Text>
              </View>
              <Text className="text-base font-semibold text-error flex-1">Logout Account</Text>
              <Text className="text-on-surface-variant">›</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
