import { test, expect } from '@playwright/test';
import { BASE, loadState, saveState, authHeaders, multipartHeaders, loginAs } from './helpers';

test.describe.serial('04 — Me & Check-in/out (Staff)', () => {
  let staffToken: string;
  let taskId: string;

  test.beforeAll(async ({ request }) => {
    const state = loadState();
    // Login as staff (re-login to get fresh token in BO's tenant)
    // Staff needs to be in BO's tenant — they accepted the invitation
    // Login will give single-tenant token since they now have 2 tenants
    const res = await request.post(`${BASE}/auth/login`, {
      data: { email: state.staffEmail || 'staff_playwright@test.com', password: 'Password123' },
    });
    const body = await res.json();
    console.log('Staff login for me-tests:', JSON.stringify(body).slice(0, 300));

    if (body.data?.requires_tenant_selection) {
      // Select BO's tenant
      const selRes = await request.post(`${BASE}/auth/select-tenant`, {
        data: { user_id: body.data.user.id, tenant_id: state.tenantId },
      });
      staffToken = (await selRes.json()).data.access_token;
    } else {
      staffToken = body.data?.access_token;
    }
    saveState({ staffToken });

    // Assign a task to staff
    const { boToken } = loadState();
    if (boToken) {
      // Create a new task to assign
      const createRes = await request.post(`${BASE}/tasks`, {
        headers: authHeaders(boToken),
        data: {
          title: 'Staff Checkin Task',
          priority: 'medium',
          due_date: new Date(Date.now() + 86400000 * 2).toISOString(),
          location_name: 'Checkin Location',
          location_lat: 10.7769,
          location_lng: 106.7009,
          location_radius_m: 50000, // Large radius so GPS check passes
        },
      });
      const createBody = await createRes.json();
      taskId = createBody.data?.id;
      saveState({ taskId });

      if (taskId && state.staffUserId) {
        await request.post(`${BASE}/tasks/${taskId}/assign`, {
          headers: authHeaders(boToken),
          data: { assignee_ids: [state.staffUserId] },
        });
      }
    }
  });

  test('Get my tasks', async ({ request }) => {
    const { staffToken } = loadState();
    if (!staffToken) { test.skip(); return; }
    const res = await request.get(`${BASE}/me/tasks`, { headers: authHeaders(staffToken) });
    const body = await res.json();
    console.log('My tasks:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Get my task history', async ({ request }) => {
    const { staffToken } = loadState();
    if (!staffToken) { test.skip(); return; }
    const res = await request.get(`${BASE}/me/tasks/history`, { headers: authHeaders(staffToken) });
    const body = await res.json();
    console.log('My history:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Check-in to task', async ({ request }) => {
    const state = loadState();
    if (!state.staffToken || !state.taskId) { test.skip(); return; }

    // Send multipart form with GPS coords (no photo required)
    const formData = new FormData();
    formData.append('lat', '10.7769');
    formData.append('lng', '106.7009');

    const res = await request.post(`${BASE}/tasks/${state.taskId}/checkin`, {
      headers: multipartHeaders(state.staffToken),
      multipart: {
        lat: '10.7769',
        lng: '106.7009',
      },
    });
    const body = await res.json();
    console.log('Checkin:', JSON.stringify(body).slice(0, 300));
    expect(res.status(), `Checkin failed: ${JSON.stringify(body)}`).toBe(201);
    expect(body.data.type).toBe('checkin');
  });

  test('Check-out from task', async ({ request }) => {
    const state = loadState();
    if (!state.staffToken || !state.taskId) { test.skip(); return; }

    const res = await request.post(`${BASE}/tasks/${state.taskId}/checkout`, {
      headers: multipartHeaders(state.staffToken),
      multipart: {
        lat: '10.7769',
        lng: '106.7009',
      },
    });
    const body = await res.json();
    console.log('Checkout:', JSON.stringify(body).slice(0, 300));
    expect(res.status(), `Checkout failed: ${JSON.stringify(body)}`).toBe(201);
    expect(body.data.type).toBe('checkout');
  });
});
