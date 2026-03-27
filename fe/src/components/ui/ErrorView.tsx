import { View, Text, Pressable } from '@/tw';

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorView({ message = 'Something went wrong', onRetry }: ErrorViewProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6 bg-white dark:bg-black">
      <Text className="text-base text-red-500 text-center">{message}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="px-6 py-2.5 rounded-xl bg-brand active:opacity-70"
        >
          <Text className="text-white font-semibold">Retry</Text>
        </Pressable>
      )}
    </View>
  );
}
