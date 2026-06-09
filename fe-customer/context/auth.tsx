import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { User } from '../types';

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });
  const processedRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        processedRef.current = null;
        setState({ user: null, token: null, loading: false });
        return;
      }
      if (processedRef.current === session.access_token) return;
      processedRef.current = session.access_token;
      await handleSupabaseSession(session);
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Native: handle deep-link OAuth callback (rescuenow://oauth-callback?code=...)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleUrl = async (url: string) => {
      if (!url) return;
      try {
        const normalized = url.includes('://') ? url : url.replace(':', '://');
        const parsed = new URL(normalized);
        const code = parsed.searchParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      } catch {
        // ignore parse errors
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  const handleSupabaseSession = async (session: Session) => {
    try {
      // Register / ensure this Supabase user is stored as role='customer' in our DB
      const result = await api.post<{ user: User; access_token: string }>(
        '/auth/register-customer',
        { access_token: session.access_token },
      );
      setState({ user: result.user, token: session.access_token, loading: false });
    } catch {
      // Fallback: try getting the existing profile (returning user)
      try {
        const profile = await api.get<User>('/auth/profile');
        setState({ user: profile, token: session.access_token, loading: false });
      } catch {
        processedRef.current = null;
        await supabase.auth.signOut();
        setState({ user: null, token: null, loading: false });
      }
    }
  };

  const loginWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      return;
    }

    // Native: PKCE with WebBrowser
    const redirectTo = makeRedirectUri({ path: 'oauth-callback' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    });
    if (error || !data.url) throw error ?? new Error('No auth URL');

    try {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const { data: existing } = await supabase.auth.getSession();
        if (existing?.session) return;
        try {
          const parsed = new URL(result.url);
          const code = parsed.searchParams.get('code');
          if (code) await supabase.auth.exchangeCodeForSession(code);
          else await supabase.auth.exchangeCodeForSession(result.url);
        } catch {
          await supabase.auth.exchangeCodeForSession(result.url);
        }
      }
    } catch {
      // Android custom tab may close on deep-link; deep-link handler above covers it
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    processedRef.current = null;
    setState({ user: null, token: null, loading: false });
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    try {
      const profile = await api.get<any>('/customer/profile');
      setState(prev => ({ ...prev, user: profile }));
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
