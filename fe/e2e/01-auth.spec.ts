import { test, expect } from '@playwright/test';
import { BASE, saveState, loadState, authHeaders } from './helpers';

const EMAIL = 'bo_playwright@test.com';
const PASSWORD = 'Password123';

test.describe.serial('01 — Auth', () => {
  test('Register BO account', async ({ request }) => {
    const res = await request.post(`${BASE}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, full_name: 'Test BO', tenant_name: 'Playwright Co', tenant_slug: 'playwright-co' },
    });
    const body = await res.json();
    console.log('Register:', JSON.stringify(body).slice(0, 300));

    if (res.status() === 409 || body.error?.code === 'EMAIL_ALREADY_EXISTS' || body.error?.code === 'SLUG_ALREADY_EXISTS') {
      // Already registered — login instead
      const loginRes = await request.post(`${BASE}/auth/login`, {
        data: { email: EMAIL, password: PASSWORD },
      });
      const loginBody = await loginRes.json();
      console.log('Login fallback:', JSON.stringify(loginBody).slice(0, 300));
      expect(loginRes.status(), `Login fallback failed: ${JSON.stringify(loginBody)}`).toBe(201);
      let token = loginBody.data?.access_token;
      let userId = loginBody.data?.user?.id;
      let tenantId = loginBody.data?.user?.tenant_id;

      if (loginBody.data?.requires_tenant_selection) {
        const tenants = loginBody.data.tenants;
        const playwrightTenant = tenants.find((t: any) => t.slug === 'playwright-co') || tenants[0];
        const selRes = await request.post(`${BASE}/auth/select-tenant`, {
          data: { user_id: loginBody.data.user.id, tenant_id: playwrightTenant.id },
        });
        const selBody = await selRes.json();
        token = selBody.data?.access_token;
        tenantId = playwrightTenant.id;
        userId = loginBody.data.user.id;
      }

      expect(token).toBeTruthy();
      saveState({ boToken: token, boUserId: userId, tenantId });
      return;
    }

    expect(res.status(), `Register failed: ${JSON.stringify(body)}`).toBe(201);
    expect(body.data.access_token).toBeTruthy();
    saveState({ boToken: body.data.access_token, boUserId: body.data.user.id, tenantId: body.data.user.tenant_id });
  });

  test('Login BO', async ({ request }) => {
    const res = await request.post(`${BASE}/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });
    const body = await res.json();
    console.log('Login:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(201);
    expect(body.data.access_token).toBeTruthy();
    saveState({ boToken: body.data.access_token });
  });

  test('Get profile', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.get(`${BASE}/auth/profile`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Profile:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(body.data.email).toBe(EMAIL);
    expect(body.data.role).toBe('business_owner');
  });

  test('Change password and revert', async ({ request }) => {
    const { boToken } = loadState();
    const newPwd = 'NewPassword456';

    const res = await request.patch(`${BASE}/auth/change-password`, {
      headers: authHeaders(boToken),
      data: { current_password: PASSWORD, new_password: newPwd, confirm_password: newPwd },
    });
    expect(res.status(), `Change pw failed: ${JSON.stringify(await res.json())}`).toBe(200);

    // Login with new password
    const loginRes = await request.post(`${BASE}/auth/login`, { data: { email: EMAIL, password: newPwd } });
    const newToken = (await loginRes.json()).data.access_token;
    expect(newToken).toBeTruthy();

    // Revert back
    await request.patch(`${BASE}/auth/change-password`, {
      headers: authHeaders(newToken),
      data: { current_password: newPwd, new_password: PASSWORD, confirm_password: PASSWORD },
    });
    saveState({ boToken: newToken });
  });

  test('Logout', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.post(`${BASE}/auth/logout`, { headers: authHeaders(boToken) });
    expect(res.status()).toBe(201);

    // Re-login to keep token valid for next specs
    const loginRes = await request.post(`${BASE}/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
    saveState({ boToken: (await loginRes.json()).data.access_token });
  });
});
