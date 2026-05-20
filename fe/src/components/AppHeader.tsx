import { Platform } from 'react-native';
import { router } from 'expo-router';
import { View, Text, Pressable } from '@/tw';
import { NotifBell } from './NotifBell';

interface AppHeaderProps {
  tenantName: string;
}

export function AppHeader({ tenantName }: AppHeaderProps) {
  const initials = tenantName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <View className="flex-row items-center justify-between px-5 pb-4 bg-surface-container-lowest" style={{ paddingTop: Platform.OS === 'web' ? 16 : 56 }}>
      <Pressable
        onPress={() => router.push('/profile')}
        className="flex-row items-center gap-3 active:opacity-70"
      >
        <View
          className="w-9 h-9 rounded-full items-center justify-center"
          style={{ backgroundColor: '#1E40AF' }}
        >
          <Text className="text-on-primary font-bold text-xs">{initials}</Text>
        </View>
        <Text className="text-base font-bold text-on-surface">{tenantName}</Text>
      </Pressable>

      <View className="flex-row items-center gap-1">
        <Pressable
          onPress={() => router.push('/chat')}
          className="w-10 h-10 items-center justify-center active:opacity-60"
        >
          <Text className="text-xl">💬</Text>
        </Pressable>

        <NotifBell />
      </View>
    </View>
  );
}
