import { useRef, useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/auth';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { staffApi } from '@/lib/api/staff';

export default function Index() {
  const { token, user, isLoading, pendingSelection, needsOnboarding } = useAuth();
  const [inviteCheckDone, setInviteCheckDone] = useState(false);
  const [hasPendingInvites, setHasPendingInvites] = useState(false);
  const checkedTokenRef = useRef<string | null>(null);

  const noTenantYet = !!(token && pendingSelection && pendingSelection.tenants.length === 0);
  const shouldCheckInvites = !!(token && (user || pendingSelection));

  useEffect(() => {
    if (!shouldCheckInvites) return;
    if (checkedTokenRef.current === token) return;
    checkedTokenRef.current = token;
    setInviteCheckDone(false);
    staffApi.myInvitations()
      .then(res => {
        const pending = res.data.filter(i => i.status === 'pending');
        setHasPendingInvites(pending.length > 0);
      })
      .catch(() => { setHasPendingInvites(false); })
      .finally(() => setInviteCheckDone(true));
  }, [token, user, shouldCheckInvites]);

  if (isLoading) return <LoadingScreen />;
  if (needsOnboarding) return <Redirect href="/(auth)/login" />;
  if (!token) return <Redirect href="/(auth)/login" />;

  // User has no tenant memberships — check invitations first before showing workspace search
  if (noTenantYet) {
    if (!inviteCheckDone) return <LoadingScreen />;
    if (hasPendingInvites) return <Redirect href="/(auth)/invitations" />;
    return <Redirect href="/(auth)/select-tenant" />;
  }

  if (pendingSelection) return <Redirect href="/(auth)/select-tenant" />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!inviteCheckDone) return <LoadingScreen />;
  if (hasPendingInvites) return <Redirect href="/(auth)/invitations" />;

  if (['staff', 'business_owner', 'operator'].includes(user.role ?? '')) return <Redirect href="/(staff)" />;
  return <Redirect href="/(auth)/login" />;
}
