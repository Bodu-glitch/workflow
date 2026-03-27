import { useState, useEffect, useRef } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, Pressable, ScrollView, Link } from '@/tw';
import { useAuth } from '@/context/auth';
import { ApiError } from '@/lib/api/client';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant px-1 mb-2">
      {children}
    </Text>
  );
}

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(false);

  const slugEdited = useRef(false);

  useEffect(() => {
    if (!slugEdited.current) {
      setTenantSlug(slugify(tenantName));
    }
  }, [tenantName]);

  function handleSlugChange(text: string) {
    slugEdited.current = true;
    setTenantSlug(text.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  async function handleRegister() {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword || !tenantName.trim()) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (tenantSlug && !/^[a-z0-9-]+$/.test(tenantSlug)) {
      Alert.alert('Error', 'Workspace URL can only contain lowercase letters, numbers, and hyphens.');
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password, fullName.trim(), tenantName.trim(), tenantSlug || undefined);
      router.replace('/');
    } catch (e) {
      let message = 'Registration failed. Please try again.';
      if (e instanceof ApiError) {
        if (e.code === 'EMAIL_ALREADY_EXISTS') message = 'Email already registered. Try signing in.';
        else if (e.code === 'SLUG_ALREADY_EXISTS') message = 'Workspace URL already taken. Choose another.';
        else message = e.message || message;
      }
      Alert.alert('Registration Failed', message);
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
        contentContainerClassName="flex-grow px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding Header */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-xl bg-primary items-center justify-center mb-6 shadow-sm">
            <Text className="text-on-primary text-3xl font-black">T</Text>
          </View>
          <Text className="text-3xl font-extrabold text-on-surface tracking-tight">
            Create Account
          </Text>
          <Text className="text-sm text-on-surface-variant mt-2">
            Set up your professional workspace
          </Text>
        </View>

        {/* Personal Info Section */}
        <View className="gap-5">
          <View>
            <FieldLabel>Full Name</FieldLabel>
            <TextInput
              className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
              placeholder="Nguyen Van A"
              placeholderTextColor="#737685"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
              editable={!loading}
            />
          </View>

          <View>
            <FieldLabel>Professional Email</FieldLabel>
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

          <View>
            <FieldLabel>Security Code</FieldLabel>
            <TextInput
              className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
              placeholder="At least 6 characters"
              placeholderTextColor="#737685"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              editable={!loading}
            />
          </View>

          <View>
            <FieldLabel>Confirm Code</FieldLabel>
            <TextInput
              className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
              placeholder="••••••••"
              placeholderTextColor="#737685"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          {/* Business info divider */}
          <View className="mt-2">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-outline mb-5">
              — Business Info
            </Text>

            <View className="gap-5">
              <View>
                <FieldLabel>Business Name</FieldLabel>
                <TextInput
                  className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
                  placeholder="Acme Corp"
                  placeholderTextColor="#737685"
                  value={tenantName}
                  onChangeText={setTenantName}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>

              <View>
                <FieldLabel>Workspace URL (optional)</FieldLabel>
                <TextInput
                  className="w-full h-14 px-4 bg-surface-container-high rounded-xl text-on-surface text-base"
                  placeholder="acme-corp"
                  placeholderTextColor="#737685"
                  value={tenantSlug}
                  onChangeText={handleSlugChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                {tenantSlug.length > 0 && (
                  <Text className="text-xs text-on-surface-variant mt-2 ml-1">
                    app.example.com/{tenantSlug}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            className="kinetic-gradient w-full h-14 rounded-xl items-center justify-center mt-2 shadow-sm active:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-on-primary font-bold text-base">Create Account</Text>
            )}
          </Pressable>
        </View>

        <View className="flex-row justify-center items-center gap-1 mt-8">
          <Text className="text-sm text-on-surface-variant">Already a member?</Text>
          <Link href="/(auth)/login" replace>
            <Text className="text-sm font-bold text-primary">Log In</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
