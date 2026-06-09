import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import React, { useEffect } from 'react';
import { useColorScheme, Alert } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/context/auth';
import { SocketProvider, useSocketContext } from '@/context/socket';
import { LocationTracker } from '@/context/location';
import { PoolTaskAlert } from '@/components/PoolTaskAlert';
import { usePushToken } from '@/hooks/usePushToken';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

// ── Push notification setup + tap handler ────────────────────────────────────
function PushNotificationSetup() {
  const { user } = useAuth();
  usePushToken(user?.id ?? null);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      const taskId = data?.task_id;
      if (taskId) {
        router.push(`/(staff)/tasks/${taskId}` as any);
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

// ── Global invitation listener (khi user đang dùng app) ──────────────────────
function InvitationListener() {
  const socket = useSocketContext();

  useEffect(() => {
    if (!socket) return;

    const handler = (data: any) => {
      if (data?.type !== 'invitation_received') return;
      Alert.alert(
        '🎉 Lời mời mới',
        'Bạn vừa nhận được lời mời vào một workspace.',
        [
          { text: 'Bỏ qua', style: 'cancel' },
          { text: 'Xem ngay', onPress: () => router.push('/(auth)/invitations') },
        ],
      );
    };

    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [socket]);

  return null;
}

function RootStack() {
  const { token, user, isLoading, pendingSelection } = useAuth();
  const isAuthenticated = !isLoading && !!token && !!user && !pendingSelection;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Protected guard={isAuthenticated && ['staff', 'business_owner', 'operator'].includes(user?.role ?? '')}>
        <Stack.Screen name="(staff)" />
      </Stack.Protected>
      <Stack.Protected guard={!isLoading && !!token}>
        <Stack.Screen name="profile" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="notifications" />
        <Stack.Screen name="chat" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AnimatedSplashOverlay />
            <RootStack />
            <PushNotificationSetup />
            <InvitationListener />
            <LocationTracker />
            <PoolTaskAlert />
          </ThemeProvider>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
