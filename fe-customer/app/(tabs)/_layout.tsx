import { Tabs } from 'expo-router';
import { COLORS } from '../../constants/config';

export default function TabsLayout() {
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
          height: 60,
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
          title: 'Khám phá',
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
        }}
      />
    </Tabs>
  );
}

function TabIcon({ icon, color, size }: { icon: string; color: string; size: number }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: size - 4 }}>{icon}</Text>;
}
