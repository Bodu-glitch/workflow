import { Stack } from 'expo-router';

/**
 * BO root layout — Stack so that non-tab screens (pricing, vouchers,
 * billing, support, rejected-overdue …) can be pushed from within tabs.
 * The actual bottom-tab bar lives in (tabs)/_layout.tsx.
 */
export default function BOLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
