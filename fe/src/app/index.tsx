import { useRef, useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { staffApi } from '@/lib/api/staff';

export default function Index() {
  const { token, user, isLoading, pendingSelection, needsOnboarding } = useAuth();
  const [inviteCheckDone, setInviteCheckDone] = useState(false);
  const [hasPendingInvites, setHasPendingInvites] = useState(false);
  const checkStarted = useRef(false);

  useEffect(() => {
    if (!token || !user || checkStarted.current) return;
    checkStarted.current = true;
    staffApi.myInvitations()
      .then(res => {
        const pending = res.data.data.filter(i => i.status === 'pending');
        setHasPendingInvites(pending.length > 0);
      })
      .catch(() => {})
      .finally(() => setInviteCheckDone(true));
  }, [token, user]);

  if (isLoading) return <LoadingScreen />;
  if (needsOnboarding) return <Redirect href="/(auth)/setup-tenant" />;
  if (pendingSelection) return <Redirect href="/(auth)/select-tenant" />;
  if (!token || !user) return <Redirect href="/(auth)/login" />;
  if (!inviteCheckDone) return <LoadingScreen />;
  if (hasPendingInvites) return <Redirect href="/(auth)/invitations" />;

  if (user.role === 'business_owner') return <Redirect href="/(bo)" />;
  if (user.role === 'operator') return <Redirect href="/(ot)" />;
  if (user.role === 'staff') return <Redirect href="/(staff)" />;
  return <Redirect href="/(auth)/login" />;
}
