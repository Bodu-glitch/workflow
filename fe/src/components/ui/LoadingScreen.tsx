import { ActivityIndicator } from 'react-native';
import { View } from '@/tw';

export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-black">
      <ActivityIndicator size="large" color="#208AEF" />
    </View>
  );
}
