import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../context/auth';
import { usePushToken } from '../hooks/usePushToken';
import { connectSocket, disconnectSocket } from '../lib/socket';

function RootNavigator() {
  const { user, token, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  usePushToken(user?.id ?? null);

  // Keep socket alive for the session — drives real-time updates across all screens
  useEffect(() => {
    if (token) {
      connectSocket(token);
    } else {
      disconnectSocket();
    }
  }, [token]);

  // Navigate to the relevant request when user taps a push notification
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      const requestId = data?.request_id;
      if (requestId) {
        router.push(`/request/${requestId}` as any);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="request" />
        <Stack.Screen name="rating" />
        <Stack.Screen name="workspace" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
