import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, Pressable, ScrollView, Link } from '@/tw';
import { useAuth } from '@/context/auth';
import { ApiError } from '@/lib/api/client';

export default function LoginScreen() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (e) {
      const message =
        e instanceof ApiError
          ? e.code === 'INVALID_CREDENTIALS'
            ? 'Wrong email or password'
            : e.message
          : 'Login failed. Please try again.';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding Header */}
        <View className="items-center mb-12">
          <View className="w-16 h-16 rounded-xl bg-primary items-center justify-center mb-6 shadow-sm">
            <Text className="text-on-primary text-3xl font-black">T</Text>
          </View>
          <Text className="text-3xl font-extrabold text-on-surface tracking-tight">
            Executive Kinetic
          </Text>
          <Text className="text-sm text-on-surface-variant mt-2">
            Access your secure professional workspace
          </Text>
        </View>

        {/* Form */}
        <View className="gap-6">
          {/* Email */}
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant px-1">
              Professional Email
            </Text>
            <TextInput
              className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
              placeholder="name@company.com"
              placeholderTextColor="#737685"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!loading}
            />
          </View>

          {/* Password */}
          <View className="gap-2">
            <View className="flex-row justify-between items-end px-1">
              <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Security Code
              </Text>
              <Link href="/(auth)/login">
                <Text className="text-xs font-semibold text-primary">Forgot?</Text>
              </Link>
            </View>
            <TextInput
              className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
              placeholder="••••••••"
              placeholderTextColor="#737685"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              editable={!loading}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />
          </View>

          {/* Actions */}
          <View className="gap-4 pt-2">
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              className="kinetic-gradient w-full h-14 rounded-xl items-center justify-center shadow-sm active:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-on-primary font-bold text-base">Sign In</Text>
              )}
            </Pressable>

            {/* Divider */}
            <View className="flex-row items-center py-2 gap-4">
              <View className="flex-1 h-px bg-outline-variant" style={{ opacity: 0.3 }} />
              <Text className="text-[10px] font-bold uppercase tracking-widest text-outline">
                or continue with
              </Text>
              <View className="flex-1 h-px bg-outline-variant" style={{ opacity: 0.3 }} />
            </View>

            {/* Google */}
            <Pressable
              onPress={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="w-full h-14 bg-surface-container-high flex-row items-center justify-center gap-3 rounded-xl active:opacity-80 disabled:opacity-50"
            >
              {googleLoading ? (
                <ActivityIndicator color="#4285F4" />
              ) : (
                <>
                  <View>
                    <Text className="text-base font-bold" style={{ color: '#4285F4' }}>G</Text>
                  </View>
                  <Text className="font-semibold text-on-surface text-base">Google</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Footer link */}
        <View className="items-center mt-8 flex-row justify-center gap-1">
          <Text className="text-sm text-on-surface-variant">New to the Kinetic platform?</Text>
          <Link href="/(auth)/register">
            <Text className="text-sm font-bold text-primary">Register</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
