import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import React, { useEffect } from 'react';
import { useColorScheme, Alert } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/auth';
import { useAuth } from '@/context/auth';
import { LocationTracker } from '@/context/location';
import { supabase } from '@/lib/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

// ── Global invitation listener (khi user đang dùng app) ──────────────────────
function InvitationListener() {
  const { user, token } = useAuth();

  useEffect(() => {
    const email = user?.email;
    if (!email || !token) return;

    const channel = supabase
      .channel(`invitation-global:${email}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'invitations',
        filter: `email=eq.${email}`,
      }, () => {
        Alert.alert(
          '🎉 Lời mời mới',
          'Bạn vừa nhận được lời mời vào một workspace.',
          [
            { text: 'Bỏ qua', style: 'cancel' },
            {
              text: 'Xem ngay',
              onPress: () => router.push('/(auth)/invitations'),
            },
          ],
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.email, token]);

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
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <RootStack />
          <InvitationListener />
          <LocationTracker />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
