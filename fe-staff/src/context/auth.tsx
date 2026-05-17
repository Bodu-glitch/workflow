import { authApi } from '@/lib/api/auth';
import { staffApi } from '@/lib/api/staff';
import { tenantStore, tokenStore } from '@/lib/api/client';
import { supabase } from '@/lib/supabase';
import type { TenantOption, UserProfile, UserRole } from '@/types/api';
import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const PENDING_INVITE_KEY = 'pending_invitation_token';

interface PendingSelection {
  userId: string;
  tenants: TenantOption[];
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  pendingSelection: PendingSelection | null;
  needsOnboarding: boolean;
}

interface AuthContextValue extends AuthState {
  loginWithGoogle: () => Promise<void>;
  loginWithGoogleForInvitation: (invitationToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  selectTenant: (userId: string, tenantId: string) => Promise<void>;
  switchTenant: () => Promise<void>;
  leaveCurrentWorkspace: () => Promise<void>;
  role: UserRole | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isLoading: true,
    pendingSelection: null,
    needsOnboarding: false,
  });

  const processedSessionRef = useRef<string | null>(null);
  const sessionProcessingRef = useRef(false);

  useEffect(() => {
    // Fallback: if onAuthStateChange never fires (rare Supabase edge case), stop loading after 8s
    const loadingTimeout = setTimeout(() => {
      setState(s => s.isLoading ? { ...s, isLoading: false } : s);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      clearTimeout(loadingTimeout);
      console.log('[Auth] onAuthStateChange event:', _event, 'session:', !!session);
      if (!session) {
        processedSessionRef.current = null;
        sessionProcessingRef.current = false;
        setState({ token: null, user: null, isLoading: false, pendingSelection: null, needsOnboarding: false });
        return;
      }
      // TOKEN_REFRESHED: apiFetch already retried with the new token inline — only
      // keep the stored token in sync. Never re-run the full auth flow here because
      // it races with whatever triggered the refresh (INITIAL_SESSION, selectTenant, etc.)
      if (_event === 'TOKEN_REFRESHED') {
        processedSessionRef.current = session.access_token;
        setState(s => (s.user || s.pendingSelection) ? { ...s, token: session.access_token } : s);
        return;
      }

      if (processedSessionRef.current === session.access_token) return;
      if (sessionProcessingRef.current) {
        processedSessionRef.current = session.access_token;
        return;
      }

      processedSessionRef.current = session.access_token;
      sessionProcessingRef.current = true;
      try {
        await handleSupabaseSession(session);
      } catch (err) {
        console.log('[Auth] handleSupabaseSession error:', err);
        processedSessionRef.current = null;
        await tokenStore.remove();
        await tokenStore.removeRefresh();
        await tenantStore.remove();
        // signOut may throw if server unreachable — ignore and clear state anyway
        await supabase.auth.signOut().catch(() => {});
        setState({ token: null, user: null, isLoading: false, pendingSelection: null, needsOnboarding: false });
      } finally {
        sessionProcessingRef.current = false;
      }
    });
    return () => { clearTimeout(loadingTimeout); subscription.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Android OAuth deep-link when app opens fresh after redirect
  // On web, Supabase handles the PKCE code exchange automatically via detectSessionInUrl=true
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleDeepLink = async (url: string) => {
      console.log('[Auth] handleDeepLink url:', url?.substring(0, 120));
      if (!url) return;

      const normalized = url.includes('://') ? url : url.replace(':', '://');

      try {
        const parsed = new URL(normalized);
        const code = parsed.searchParams.get('code');
        if (code) {
          console.log('[Auth] handleDeepLink PKCE code found, exchanging...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          console.log('[Auth] handleDeepLink exchangeCodeForSession result - error:', JSON.stringify(error), 'session:', !!data?.session);
          return;
        }
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

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSupabaseSession = async (session: Session) => {
    console.log('[Auth] handleSupabaseSession start, token prefix:', session.access_token?.substring(0, 20));
    await tokenStore.set(session.access_token);
    await tokenStore.setRefresh(session.refresh_token);

    // Check for pending invitation token (new user accepting invite via email link)
    const pendingInvite = Platform.OS === 'web'
      ? (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PENDING_INVITE_KEY) : null)
      : await AsyncStorage.getItem(PENDING_INVITE_KEY);

    if (pendingInvite) {
      // Clear it first to avoid loops
      if (Platform.OS === 'web') {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(PENDING_INVITE_KEY);
      } else {
        await AsyncStorage.removeItem(PENDING_INVITE_KEY);
      }

      try {
        const { data } = await staffApi.acceptInvitationGoogle(session.access_token, pendingInvite);
        await tenantStore.set(data.tenant.id);
        // Fetch profile with tenant context — tenantStore is now set so X-Tenant-ID will be sent
        const { data: profileData } = await authApi.profile();
        const profile = profileData as UserProfile & { tenants?: TenantOption[] };
        // Ensure role is populated; fallback to user data from invitation response
        if (!profile.role && data.user) {
          (profile as any).role = data.user.role ?? 'staff';
        }
        setState({ token: session.access_token, user: profile, isLoading: false, pendingSelection: null, needsOnboarding: false });
        return;
      } catch (err) {
        console.log('[Auth] acceptInvitationGoogle error:', err);
        // Fall through to normal profile check
      }
    }

    // Clear stored tenant before profile fetch: sending a stale X-Tenant-ID causes the guard
    // to return 401 if the membership was revoked.
    const storedTenantId = await tenantStore.get();
    console.log('[Auth] tenantId from store:', storedTenantId);
    if (storedTenantId) await tenantStore.remove();

    const { data: profileData } = await authApi.profile();
    // apiFetch may have internally refreshed the token (if session.access_token was expired).
    // Use the current token from the store (may be newer) and mark it processed so the
    // subsequent TOKEN_REFRESHED event doesn't race with our setState below.
    const activeToken = Platform.OS === 'web'
      ? (localStorage.getItem('auth_token') ?? session.access_token)
      : await tokenStore.get() ?? session.access_token;
    if (activeToken !== session.access_token) {
      processedSessionRef.current = activeToken;
    }
    const profile = profileData as any;

    // User has no workspace membership — show workspace search/apply screen
    if (profile?.requires_onboarding) {
      setState({ token: activeToken, user: null, isLoading: false, pendingSelection: { userId: session.user.id, tenants: [] }, needsOnboarding: false });
      return;
    }

    const typedProfile = profile as UserProfile & { tenants?: TenantOption[] };
    const tenants = typedProfile.tenants ?? [];
    console.log('[Auth] profile fetched, role:', typedProfile.role, 'tenants:', tenants.length);

    if (typedProfile.role === 'superadmin') {
      setState({ token: activeToken, user: typedProfile, isLoading: false, pendingSelection: null, needsOnboarding: false });
      return;
    }

    // fe-staff is for staff/operators only — exclude workspaces where user is business_owner
    const staffTenants = tenants.filter(t => t.role !== 'business_owner');

    if (staffTenants.length === 0) {
      // User has no staff/operator memberships yet — show empty selection screen
      setState((s) => ({
        ...s,
        token: activeToken,
        isLoading: false,
        needsOnboarding: false,
        pendingSelection: { userId: typedProfile.id, tenants: [] },
      }));
      return;
    }

    // Restore previously selected workspace if still valid
    if (storedTenantId) {
      const storedMembership = staffTenants.find(t => t.id === storedTenantId);
      if (storedMembership) {
        await tenantStore.set(storedTenantId);
        setState({
          token: activeToken,
          user: { ...typedProfile, role: storedMembership.role, tenant_id: storedTenantId },
          isLoading: false,
          pendingSelection: null,
          needsOnboarding: false,
        });
        return;
      }
    }

    // Only one workspace — go straight in without asking
    if (staffTenants.length === 1) {
      const onlyTenant = staffTenants[0];
      await tenantStore.set(onlyTenant.id);
      setState({
        token: activeToken,
        user: { ...typedProfile, role: onlyTenant.role, tenant_id: onlyTenant.id },
        isLoading: false,
        pendingSelection: null,
        needsOnboarding: false,
      });
      return;
    }

    console.log('[Auth] setState pendingSelection, staffTenants:', staffTenants.length);
    setState((s) => ({
      ...s,
      token: activeToken,
      isLoading: false,
      needsOnboarding: false,
      pendingSelection: { userId: typedProfile.id, tenants: staffTenants },
    }));
  };

  const loginWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
      return;
    }

    const redirectTo = makeRedirectUri({ path: 'oauth-callback' });
    console.log('[Auth] loginWithGoogle native, redirectTo:', redirectTo);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    });
    if (error || !data.url) throw error ?? new Error('No auth URL returned');

    try {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      console.log('[Auth] openAuthSessionAsync result type:', result.type);
      if (result.type === 'success') {
        console.log('[Auth] openAuthSessionAsync success url:', result.url?.substring(0, 100));
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithGoogleForInvitation = useCallback(async (invitationToken: string) => {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(PENDING_INVITE_KEY, invitationToken);
    } else {
      await AsyncStorage.setItem(PENDING_INVITE_KEY, invitationToken);
    }
    await loginWithGoogle();
  }, [loginWithGoogle]);

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
    setState({ token: null, user: null, isLoading: false, pendingSelection: null, needsOnboarding: false });
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: user } = await authApi.profile();
    setState((s) => ({ ...s, user: user as UserProfile }));
  }, []);

  const selectTenant = useCallback(async (_userId: string, tenantId: string) => {
    await tenantStore.set(tenantId);
    const { data: user } = await authApi.profile();
    setState((s) => ({ ...s, user: user as UserProfile, isLoading: false, pendingSelection: null, needsOnboarding: false }));
  }, []);

  const switchTenant = useCallback(async () => {
    const tenants = (state.user as any)?.tenants ?? [];
    const userId = state.user?.id ?? '';
    await tenantStore.remove();
    setState((s) => ({
      ...s,
      user: null,
      pendingSelection: { userId, tenants },
    }));
  }, [state.user]);

  const leaveCurrentWorkspace = useCallback(async () => {
    const currentTenantId = state.user?.tenant_id;
    const remainingTenants = ((state.user as any)?.tenants ?? []).filter(
      (t: any) => t.id !== currentTenantId,
    );
    const userId = state.user?.id ?? '';
    await tenantStore.remove();
    setState((s) => ({
      ...s,
      user: null,
      pendingSelection: { userId, tenants: remainingTenants },
    }));
  }, [state.user]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        loginWithGoogle,
        loginWithGoogleForInvitation,
        logout,
        refreshProfile,
        selectTenant,
        switchTenant,
        leaveCurrentWorkspace,
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
