import { useRouter } from 'expo-router';
import { View, Text, Pressable, ScrollView } from '@/tw';

export default function RegisterScreen() {
  const router = useRouter();

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
          Create Account
        </Text>
        <Text className="text-sm text-on-surface-variant mt-3 text-center leading-5">
          Accounts are created via workspace invitations. Please check your email for an invitation.
        </Text>
      </View>

      <Pressable
        onPress={() => router.replace('/(auth)/login')}
        className="w-full h-14 bg-surface-container-high rounded-xl items-center justify-center active:opacity-80"
      >
        <Text className="font-semibold text-on-surface text-base">Back to Login</Text>
      </Pressable>
    </ScrollView>
  );
}
