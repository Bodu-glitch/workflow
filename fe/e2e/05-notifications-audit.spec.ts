import { test, expect } from '@playwright/test';
import { BASE, loadState, authHeaders } from './helpers';

test.describe.serial('05 — Notifications', () => {
  test('Get notifications', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.get(`${BASE}/notifications`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Notifications:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Get unread count', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.get(`${BASE}/notifications/unread-count`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Unread count:', JSON.stringify(body));
    expect(res.status()).toBe(200);
    expect(typeof body.data.count).toBe('number');
  });

  test('Mark all notifications read', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.patch(`${BASE}/notifications/read-all`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Mark all read:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
  });

  test('Staff notifications', async ({ request }) => {
    const { staffToken } = loadState();
    if (!staffToken) { test.skip(); return; }
    const res = await request.get(`${BASE}/notifications`, { headers: authHeaders(staffToken) });
    const body = await res.json();
    console.log('Staff notifications:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);

    // Mark individual notification read if any
    if (body.data?.length > 0) {
      const notifId = body.data[0].id;
      const readRes = await request.patch(`${BASE}/notifications/${notifId}/read`, {
        headers: authHeaders(staffToken),
      });
      expect(readRes.status()).toBe(200);
    }
  });
});

test.describe.serial('06 — Audit Log', () => {
  test('Get tenant audit log', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.get(`${BASE}/audit`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Audit log:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(Array.isArray(body.data)).toBeTruthy();
    console.log(`Audit log entries: ${body.data.length}`);
  });

  test('Get task audit log', async ({ request }) => {
    const { boToken, taskId } = loadState();
    if (!taskId) { test.skip(); return; }
    const res = await request.get(`${BASE}/audit/tasks/${taskId}`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Task audit:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('Get staff audit log', async ({ request }) => {
    const { boToken, staffUserId } = loadState();
    if (!staffUserId) { test.skip(); return; }
    const res = await request.get(`${BASE}/audit/staff/${staffUserId}`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Staff audit:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(Array.isArray(body.data)).toBeTruthy();
  });
});
