import { authApi } from '@/lib/api/auth';
import { tenantStore, tokenStore } from '@/lib/api/client';
import { supabase } from '@/lib/supabase';
import type { TenantOption, UserProfile, UserRole } from '@/types/api';
import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

interface PendingSelection {
  userId: string;
  tenants: TenantOption[];
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  pendingSelection: PendingSelection | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  register: (email: string, password: string, fullName: string, tenantName: string, tenantSlug?: string) => Promise<void>;
  selectTenant: (userId: string, tenantId: string) => Promise<void>;
  role: UserRole | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isLoading: true,
    pendingSelection: null,
  });

  const processedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[Auth] onAuthStateChange event:', _event, 'session:', !!session);
      if (!session) {
        processedSessionRef.current = null;
        setState({ token: null, user: null, isLoading: false, pendingSelection: null });
        return;
      }
      // Skip duplicate: same access_token fired by SIGNED_IN + TOKEN_REFRESHED or double Linking trigger
      if (processedSessionRef.current === session.access_token) return;
      processedSessionRef.current = session.access_token;
      try {
        await handleSupabaseSession(session);
      } catch (err) {
        console.log('[Auth] handleSupabaseSession error:', err);
        processedSessionRef.current = null;
        setState({ token: null, user: null, isLoading: false, pendingSelection: null });
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Android OAuth deep-link when app opens fresh after redirect
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log('[Auth] handleDeepLink url:', url?.substring(0, 120));
      if (!url) return;

      // Normalize URL: some Android deep links omit '//' (e.g. "taskmanagement:?code=...")
      // Supabase exchangeCodeForSession requires '://' to parse as URL
      const normalized = url.includes('://') ? url : url.replace(':', '://');

      // PKCE flow: extract code param and exchange
      try {
        const parsed = new URL(normalized);
        const code = parsed.searchParams.get('code');
        if (code) {
          console.log('[Auth] handleDeepLink PKCE code found, exchanging...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          console.log('[Auth] handleDeepLink exchangeCodeForSession result - error:', JSON.stringify(error), 'session:', !!data?.session);
          return;
        }
        // Implicit flow fallback: access_token in fragment
        const fragment = parsed.hash.substring(1);
        if (fragment.includes('access_token')) {
          console.log('[Auth] handleDeepLink implicit token found');
          const { data, error } = await supabase.auth.exchangeCodeForSession(url);
          console.log('[Auth] handleDeepLink implicit result - error:', JSON.stringify(error), 'session:', !!data?.session);
        }
      } catch (err) {
        console.log('[Auth] handleDeepLink parse/exchange error:', err);
      }
    };

    // App opened fresh via deep link (Android OAuth redirect)
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });

    // App already running, receives deep link
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSupabaseSession = async (session: Session) => {
    console.log('[Auth] handleSupabaseSession start, token prefix:', session.access_token?.substring(0, 20));
    await tokenStore.set(session.access_token);
    await tokenStore.setRefresh(session.refresh_token);

    const { data: profileData } = await authApi.profile();
    const profile = profileData as UserProfile & { tenants?: TenantOption[] };
    const tenants = profile.tenants ?? [];
    console.log('[Auth] profile fetched, role:', profile.role, 'tenants:', tenants.length);

    if (profile.role === 'superadmin') {
      setState({ token: session.access_token, user: profile as UserProfile, isLoading: false, pendingSelection: null });
      return;
    }

    // If user already selected a tenant (stored in tenantStore), restore directly
    const tenantId = await tenantStore.get();
    console.log('[Auth] tenantId from store:', tenantId);
    if (tenantId) {
      setState({ token: session.access_token, user: profile as UserProfile, isLoading: false, pendingSelection: null });
      return;
    }

    // No tenant selected yet — route through select-tenant
    console.log('[Auth] setState pendingSelection, tenants:', tenants.length);
    setState((s) => ({
      ...s,
      token: session.access_token,
      isLoading: false,
      pendingSelection: { userId: profile.id, tenants },
    }));
  };

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    const d = data as any;

    await tokenStore.set(d.access_token);
    await tokenStore.setRefresh(d.refresh_token);

    // Superadmin: no tenant selection needed
    if (d.user?.role === 'superadmin') {
      const { data: user } = await authApi.profile();
      setState({ token: d.access_token, user: user as UserProfile, isLoading: false, pendingSelection: null });
      return;
    }

    // All others: always go through select-tenant
    setState((s) => ({ ...s, token: d.access_token, pendingSelection: { userId: d.user.id, tenants: d.tenants ?? [] } }));
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // onAuthStateChange handles the session after redirect
      return;
    }

    // Native: use dedicated oauth-callback path so Expo Router routes within (auth) group
    // instead of pushing index onto the root stack
    const redirectTo = makeRedirectUri({ path: 'oauth-callback' });
    console.log('[Auth] loginWithGoogle native, redirectTo:', redirectTo);
    // Native (iOS/Android) — opens system browser, works in Expo Go
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) throw error ?? new Error('No auth URL returned');

    try {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      console.log('[Auth] openAuthSessionAsync result type:', result.type);
      // iOS / Android (when Custom Tab properly intercepts): handle directly
      if (result.type === 'success') {
        console.log('[Auth] openAuthSessionAsync success url:', result.url?.substring(0, 100));
        // Check if Linking (handleDeepLink) already exchanged the code — happens on Android
        // when deep link fires while Custom Tab is still open (Linking fires first)
        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession?.session) {
          console.log('[Auth] openAuthSessionAsync: session already exists, skip exchange');
          return;
        }
        const normalized = result.url.includes('://') ? result.url : result.url.replace(':', '://');
        try {
          const parsed = new URL(normalized);
          const code = parsed.searchParams.get('code');
          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            console.log('[Auth] openAuthSessionAsync exchangeCode result - error:', JSON.stringify(error), 'session:', !!data?.session);
          } else {
            await supabase.auth.exchangeCodeForSession(result.url);
          }
        } catch {
          await supabase.auth.exchangeCodeForSession(result.url);
        }
      }
    } catch (err) {
      console.log('[Auth] openAuthSessionAsync error (Android Custom Tab may close on deep link):', err);
      // Android: Custom Tab may close with an error when the deep link fires.
      // The Linking listener handles the actual session in this case — ignore.
    }
    // Android fresh-launch case: Linking listener above handles the callback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout errors
    }
    await supabase.auth.signOut().catch(() => {});
    await tokenStore.remove();
    await tokenStore.removeRefresh();
    await tenantStore.remove();
    setState({ token: null, user: null, isLoading: false, pendingSelection: null });
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: user } = await authApi.profile();
    setState((s) => ({ ...s, user: user as UserProfile }));
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string, tenantName: string, tenantSlug?: string) => {
    const { data } = await authApi.register({ email, password, full_name: fullName, tenant_name: tenantName, tenant_slug: tenantSlug });
    const d = data as any;
    await tokenStore.set(d.access_token);
    await tokenStore.setRefresh(d.refresh_token);
    const tenantId = d.tenant?.id ?? d.user?.tenant_id ?? null;
    if (tenantId) await tenantStore.set(tenantId);
    const { data: user } = await authApi.profile();
    setState({ token: d.access_token, user: user as UserProfile, isLoading: false, pendingSelection: null });
  }, []);

  const selectTenant = useCallback(async (_userId: string, tenantId: string) => {
    await tenantStore.set(tenantId);
    const { data: user } = await authApi.profile();
    setState((s) => ({ ...s, user: user as UserProfile, isLoading: false, pendingSelection: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginWithGoogle,
        logout,
        refreshProfile,
        register,
        selectTenant,
        role: state.user?.role ?? null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
