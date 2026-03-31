import { apiFetch } from './client';
import type { UserProfile, GoogleOnboardingResponse } from '@/types/api';

export const authApi = {
  logout: () =>
    apiFetch<{ data: { success: boolean } }>('/auth/logout', { method: 'POST' }),

  profile: () =>
    apiFetch<{ data: UserProfile }>('/auth/profile'),

  completeGoogleOnboarding: (access_token: string, tenant_name: string, tenant_slug?: string) =>
    apiFetch<{ data: GoogleOnboardingResponse }>('/auth/complete-google-onboarding', {
      method: 'POST',
      body: JSON.stringify({ access_token, tenant_name, tenant_slug }),
    }),

  updateDeviceToken: (device_token: string | null) =>
    apiFetch<{ data: { success: boolean } }>('/auth/device-token', {
      method: 'PATCH',
      body: JSON.stringify({ device_token }),
    }),

  createTenant: (input: { tenant_name: string; tenant_slug?: string }) =>
    apiFetch<{ data: { tenant: { id: string; name: string; slug: string } } }>('/auth/create-tenant', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
