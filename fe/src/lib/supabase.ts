import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Web-safe async storage adapter for Supabase session persistence on native
const nativeStorageAdapter = Platform.OS !== 'web'
  ? {
      getItem: async (key: string) => {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        return AsyncStorage.getItem(key);
      },
      setItem: async (key: string, value: string) => {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem(key, value);
      },
      removeItem: async (key: string) => {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.removeItem(key);
      },
    }
  : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: nativeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});
