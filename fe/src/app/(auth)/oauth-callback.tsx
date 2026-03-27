import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAuth } from '@/context/auth';

// Handles OAuth deep link callback (taskmanagement://oauth-callback?code=...).
// Expo Router navigates here instead of the root index, keeping navigation
// within the (auth) group. Once auth state resolves, this screen navigates
// to the appropriate destination.
export default function OAuthCallback() {
  const { token, user, isLoading, pendingSelection } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (pendingSelection) { router.replace('/(auth)/select-tenant'); return; }
    if (token && user) { router.replace('/'); return; }
    router.replace('/(auth)/login');
  }, [isLoading, pendingSelection, token, user]);

  return <LoadingScreen />;
}
