import { Platform } from 'react-native';
import { router } from 'expo-router';
import { View, Text, Pressable } from '@/tw';

interface AppHeaderProps {
  tenantName: string;
  unreadCount?: number;
}

export function AppHeader({ tenantName, unreadCount = 0 }: AppHeaderProps) {
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

      <Pressable
        onPress={() => router.push('/notifications')}
        className="w-10 h-10 items-center justify-center active:opacity-60"
      >
        <Text className="text-xl">🔔</Text>
        {unreadCount > 0 && (
          <View
            className="absolute top-1 right-1 w-4 h-4 rounded-full items-center justify-center"
            style={{ backgroundColor: '#ba1a1a' }}
          >
            <Text className="text-white font-bold" style={{ fontSize: 9 }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}
