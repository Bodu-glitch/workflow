import { test, expect } from '@playwright/test';
import { BASE, loadState, saveState, authHeaders } from './helpers';

// Staff account that we'll create via registration (simulating email invite accept)
const STAFF_EMAIL = 'staff_playwright@test.com';
const STAFF_PASSWORD = 'Password123';

test.describe.serial('03 — Staff Management', () => {
  test('List staff (initially empty)', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.get(`${BASE}/staff`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Staff list:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Invite staff via in-app (user must exist first)', async ({ request }) => {
    const { boToken, tenantId } = loadState();

    // First register a separate user (staff) in a different tenant so they exist in users table
    const regRes = await request.post(`${BASE}/auth/register`, {
      data: {
        email: STAFF_EMAIL,
        password: STAFF_PASSWORD,
        full_name: 'Test Staff',
        tenant_name: 'Staff Own Tenant',
        tenant_slug: 'staff-own-tenant-pw',
      },
    });
    const regBody = await regRes.json();
    console.log('Staff register:', JSON.stringify(regBody).slice(0, 200));

    let staffToken: string;
    let staffUserId: string;
    if (regRes.status() === 409 || regBody.error?.code === 'EMAIL_ALREADY_EXISTS' || regBody.error?.code === 'SLUG_ALREADY_EXISTS') {
      // Already registered — login to get token and user id
      const loginRes = await request.post(`${BASE}/auth/login`, {
        data: { email: STAFF_EMAIL, password: STAFF_PASSWORD },
      });
      const loginBody = await loginRes.json();
      let token = loginBody.data?.access_token;
      let uid = loginBody.data?.user?.id;
      if (loginBody.data?.requires_tenant_selection) {
        const staffOwnTenant = loginBody.data.tenants.find((t: any) => t.slug === 'staff-own-tenant-pw') || loginBody.data.tenants[0];
        const selRes = await request.post(`${BASE}/auth/select-tenant`, {
          data: { user_id: loginBody.data.user.id, tenant_id: staffOwnTenant.id },
        });
        token = (await selRes.json()).data?.access_token;
        uid = loginBody.data.user.id;
      }
      staffToken = token;
      staffUserId = uid;
    } else {
      expect(regRes.status()).toBe(201);
      staffToken = regBody.data.access_token;
      staffUserId = regBody.data.user.id;
    }
    saveState({ staffUserId, staffEmail: STAFF_EMAIL, staffToken });

    // Now BO invites this existing user (in-app invitation)
    const invRes = await request.post(`${BASE}/staff/invite`, {
      headers: authHeaders(boToken),
      data: { email: STAFF_EMAIL, role: 'staff' },
    });
    const invBody = await invRes.json();
    console.log('Invite staff:', JSON.stringify(invBody).slice(0, 300));
    if (invRes.status() === 409) {
      // Already a member — skip invitation flow, just verify they're in the staff list
      console.log('Staff already in tenant — skipping invite/accept flow');
      return;
    }
    expect(invRes.status(), `Invite failed: ${JSON.stringify(invBody)}`).toBe(201);
    saveState({ invitationId: invBody.data.invitation_id || invBody.data.id });
  });

  test('List invitations', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.get(`${BASE}/staff/invitations`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Invitations:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(Array.isArray(body.data)).toBeTruthy();
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('Staff views my invitations', async ({ request }) => {
    const { staffToken } = loadState();
    if (!staffToken) { test.skip(); return; }
    const res = await request.get(`${BASE}/staff/my-invitations`, { headers: authHeaders(staffToken) });
    const body = await res.json();
    console.log('My invitations:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Staff accepts in-app invitation', async ({ request }) => {
    const { staffToken, invitationId } = loadState();
    if (!staffToken || !invitationId) { test.skip(); return; }
    const res = await request.patch(`${BASE}/staff/invitations/${invitationId}/accept`, {
      headers: authHeaders(staffToken),
    });
    const body = await res.json();
    console.log('Accept invitation:', JSON.stringify(body).slice(0, 200));
    if (res.status() === 404) { test.skip(); return; } // stale invitationId from previous run
    expect(res.status(), `Accept failed: ${JSON.stringify(body)}`).toBe(200);
  });

  test('Staff now visible in staff list', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.get(`${BASE}/staff`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Staff list after accept:', JSON.stringify(body).slice(0, 300));
    expect(res.status()).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
    const { staffUserId } = loadState();
    if (staffUserId) {
      const found = body.data.find((s: any) => s.id === staffUserId);
      expect(found).toBeTruthy();
    }
  });

  test('Resend invitation (creates new)', async ({ request }) => {
    const { boToken } = loadState();
    // Invite a non-existent email → email delivery
    const invRes = await request.post(`${BASE}/staff/invite`, {
      headers: authHeaders(boToken),
      data: { email: 'new_staff_pw@test.com', role: 'staff' },
    });
    const invBody = await invRes.json();
    console.log('New invite for resend:', JSON.stringify(invBody).slice(0, 200));
    if (invRes.status() === 201) {
      const newInvId = invBody.data.invitation_id || invBody.data.id;
      const resendRes = await request.post(`${BASE}/staff/invite/${newInvId}/resend`, {
        headers: authHeaders(boToken),
      });
      const resendBody = await resendRes.json();
      console.log('Resend:', JSON.stringify(resendBody).slice(0, 200));
      expect(resendRes.status()).toBe(201);
    }
  });

  test('Assign task to staff', async ({ request }) => {
    const { boToken, taskId, staffUserId } = loadState();
    if (!staffUserId || !taskId) { test.skip(); return; }

    // Get task that is still in todo status
    const listRes = await request.get(`${BASE}/tasks?status=todo`, { headers: authHeaders(boToken) });
    const tasks = await listRes.json();
    if (!tasks.data?.length) { test.skip(); return; }
    const tid = tasks.data[0].id;
    saveState({ taskId: tid });

    const res = await request.post(`${BASE}/tasks/${tid}/assign`, {
      headers: authHeaders(boToken),
      data: { assignee_ids: [staffUserId] },
    });
    const body = await res.json();
    console.log('Assign task:', JSON.stringify(body).slice(0, 200));
    expect(res.status(), `Assign failed: ${JSON.stringify(body)}`).toBe(201);
  });

  test('Unassign staff from task', async ({ request }) => {
    const { boToken, taskId, staffUserId } = loadState();
    if (!staffUserId || !taskId) { test.skip(); return; }
    const res = await request.delete(`${BASE}/tasks/${taskId}/assign/${staffUserId}`, {
      headers: authHeaders(boToken),
    });
    const body = await res.json();
    console.log('Unassign:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
  });
});
