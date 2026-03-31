import { useState } from 'react';
import { Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, Pressable, ScrollView } from '@/tw';
import { useAuth } from '@/context/auth';
import { ApiError } from '@/lib/api/client';

export default function AcceptInvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { loginWithGoogleForInvitation } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    if (!token) {
      Alert.alert('Lỗi', 'Liên kết lời mời không hợp lệ');
      return;
    }
    setLoading(true);
    try {
      await loginWithGoogleForInvitation(token);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Không thể xác thực với Google, vui lòng thử lại.';
      Alert.alert('Lỗi', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="flex-grow justify-center px-6 py-12"
    >
      <View className="items-center mb-10">
        <View className="w-16 h-16 rounded-xl bg-primary items-center justify-center mb-6 shadow-sm">
          <Text className="text-on-primary text-3xl font-black">T</Text>
        </View>
        <Text className="text-2xl font-extrabold text-on-surface tracking-tight text-center">
          Lời mời tham gia
        </Text>
        <Text className="text-sm text-on-surface-variant mt-2 text-center">
          Bạn đã được mời tham gia workspace. Đăng nhập bằng Google để chấp nhận.
        </Text>
      </View>

      {!token && (
        <Text className="text-error text-center mb-6">
          Liên kết lời mời không hợp lệ hoặc đã hết hạn.
        </Text>
      )}

      <Pressable
        onPress={handleAccept}
        disabled={loading || !token}
        className="w-full h-14 bg-surface-container-high flex-row items-center justify-center gap-3 rounded-xl active:opacity-80 disabled:opacity-50"
      >
        {loading ? (
          <ActivityIndicator color="#4285F4" />
        ) : (
          <>
            <Text className="text-base font-bold" style={{ color: '#4285F4' }}>G</Text>
            <Text className="font-semibold text-on-surface text-base">Đăng nhập với Google để chấp nhận</Text>
          </>
        )}
      </Pressable>

      <Pressable onPress={() => router.replace('/(auth)/login')} className="mt-6 items-center">
        <Text className="text-sm text-on-surface-variant">Quay lại đăng nhập</Text>
      </Pressable>
    </ScrollView>
  );
}
