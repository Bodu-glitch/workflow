import { Stack } from 'expo-router';
import { useAuth } from '@/context/auth';

export default function AuthLayout() {
  const { pendingSelection, token, user, isLoading } = useAuth();

  if (isLoading) return null;

  const isAuthenticated = !!token && !!user && !pendingSelection;
  const canLogin = !isAuthenticated && !pendingSelection;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Always accessible — handles OAuth deep link callback */}
      <Stack.Screen name="oauth-callback" />
      {/* Always accessible — new users accepting email invitations have no session */}
      <Stack.Screen name="accept-invitation" />
      <Stack.Protected guard={canLogin}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
      <Stack.Protected guard={!!pendingSelection}>
        <Stack.Screen name="select-tenant" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated || !!(pendingSelection && pendingSelection.tenants.length === 0)}>
        <Stack.Screen name="invitations" />
      </Stack.Protected>
    </Stack>
  );
}
