import { useState } from 'react';
import { Alert, ActivityIndicator } from 'react-native';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { useAuth } from '@/context/auth';
import { ApiError } from '@/lib/api/client';

export default function LoginScreen() {
  const { loginWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Google sign-in failed. Please try again.';
      Alert.alert('Google Sign-In Failed', message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="flex-grow justify-center px-6 py-12"
    >
      {/* Branding Header */}
      <View className="items-center mb-16">
        <View className="w-16 h-16 rounded-xl bg-primary items-center justify-center mb-6 shadow-sm">
          <Text className="text-on-primary text-3xl font-black">T</Text>
        </View>
        <Text className="text-3xl font-extrabold text-on-surface tracking-tight">
          Executive Kinetic
        </Text>
        <Text className="text-sm text-on-surface-variant mt-2 text-center">
          Access your secure professional workspace
        </Text>
      </View>

      {/* Google Sign-In */}
      <Pressable
        onPress={handleGoogleLogin}
        disabled={googleLoading}
        className="w-full h-14 bg-surface-container-high flex-row items-center justify-center gap-3 rounded-xl active:opacity-80 disabled:opacity-50"
      >
        {googleLoading ? (
          <ActivityIndicator color="#4285F4" />
        ) : (
          <>
            <Text className="text-base font-bold" style={{ color: '#4285F4' }}>G</Text>
            <Text className="font-semibold text-on-surface text-base">Sign in with Google</Text>
          </>
        )}
      </Pressable>


    </ScrollView>
  );
}
