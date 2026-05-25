import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/auth';
import { useAuth } from '@/context/auth';
import { ToastProvider } from '@/context/toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

function TenantCacheManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const prevTenantRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const tenantId = user?.tenant_id ?? null;
    if (prevTenantRef.current !== undefined && prevTenantRef.current !== tenantId) {
      qc.clear();
    }
    prevTenantRef.current = tenantId;
  }, [user?.tenant_id, qc]);

  return null;
}

function RootStack() {
  const { token, user, isLoading, pendingSelection } = useAuth();
  const isAuthenticated = !isLoading && !!token && !!user && !pendingSelection;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Protected guard={isAuthenticated && user?.role === 'business_owner'}>
        <Stack.Screen name="(bo)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && user?.role === 'operator'}>
        <Stack.Screen name="(ot)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && user?.role === 'staff'}>
        <Stack.Screen name="(staff)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile" />
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
        <TenantCacheManager />
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <ToastProvider>
            <AnimatedSplashOverlay />
            <RootStack />
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
