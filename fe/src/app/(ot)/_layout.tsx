import { Stack } from 'expo-router';

/**
 * OT root layout — Stack so that non-tab screens (pricing, vouchers,
 * support, rejected-overdue …) can be pushed from within tabs.
 * The actual bottom-tab bar lives in (tabs)/_layout.tsx.
 */
export default function OTLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
