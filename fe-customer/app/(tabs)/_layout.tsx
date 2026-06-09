import { Tabs } from 'expo-router';
import { COLORS } from '../../constants/config';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Text, View } from 'react-native';

function TabIcon({ icon, color, size, badge }: { icon: string; color: string; size: number; badge?: number }) {
  return (
    <View style={{ position: 'relative' }}>
      <Text style={{ fontSize: size - 4 }}>{icon}</Text>
      {badge && badge > 0 ? (
        <View style={{
          position: 'absolute', top: -4, right: -8,
          backgroundColor: COLORS.error,
          borderRadius: 8, minWidth: 16, height: 16,
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 3,
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Refresh unread count every 30s
    const loadUnread = async () => {
      try {
        const result = await api.get<{ count: number }>('/notifications/unread-count');
        setUnreadCount((result as any).count ?? 0);
      } catch {}
    };
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.surface,
          paddingBottom: 4,
          height: 64,
        },
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon="🏠" color={color} size={size} />
          ),
          headerTitle: 'RescueNow',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Tìm kiếm',
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon="🔍" color={color} size={size} />
          ),
          headerTitle: 'Tìm kiếm dịch vụ',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Lịch sử',
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon="📋" color={color} size={size} />
          ),
          headerTitle: 'Lịch sử yêu cầu',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Tôi',
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon="👤" color={color} size={size} />
          ),
          headerTitle: 'Tài khoản',
          headerRight: () => (
            <NotificationBell unread={unreadCount} />
          ),
        }}
      />
    </Tabs>
  );
}

function NotificationBell({ unread }: { unread: number }) {
  const { TouchableOpacity } = require('react-native');
  const { router } = require('expo-router');
  return (
    <TouchableOpacity
      style={{ marginRight: 16, position: 'relative' }}
      onPress={() => router.push('/notifications')}
    >
      <Text style={{ fontSize: 22 }}>🔔</Text>
      {unread > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -4,
          backgroundColor: COLORS.error,
          borderRadius: 8, minWidth: 16, height: 16,
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 3,
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
