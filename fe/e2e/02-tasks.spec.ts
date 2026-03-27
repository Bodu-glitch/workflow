import { test, expect } from '@playwright/test';
import { BASE, loadState, saveState, authHeaders } from './helpers';

test.describe.serial('02 — Tasks (BO)', () => {
  test('Dashboard stats', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.get(`${BASE}/tasks/dashboard`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Dashboard:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(body.data).toHaveProperty('summary');
  });

  test('Create task', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.post(`${BASE}/tasks`, {
      headers: authHeaders(boToken),
      data: {
        title: 'Playwright Test Task',
        description: 'Created by Playwright',
        priority: 'high',
        status: 'todo',
        due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
        location_name: 'Test Location',
        location_lat: 10.7769,
        location_lng: 106.7009,
        location_radius_m: 100,
      },
    });
    const body = await res.json();
    console.log('Create task:', JSON.stringify(body).slice(0, 300));
    expect(res.status(), `Create task failed: ${JSON.stringify(body)}`).toBe(201);
    expect(body.data.title).toBe('Playwright Test Task');
    saveState({ taskId: body.data.id });
  });

  test('List tasks', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.get(`${BASE}/tasks`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('List tasks:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(Array.isArray(body.data)).toBeTruthy();
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('Get task detail', async ({ request }) => {
    const { boToken, taskId } = loadState();
    const res = await request.get(`${BASE}/tasks/${taskId}`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Task detail:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(body.data.id).toBe(taskId);
  });

  test('Update task', async ({ request }) => {
    const { boToken, taskId } = loadState();
    const res = await request.patch(`${BASE}/tasks/${taskId}`, {
      headers: authHeaders(boToken),
      data: { description: 'Updated by Playwright' },
    });
    const body = await res.json();
    console.log('Update task:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(body.data.description).toBe('Updated by Playwright');
  });

  test('Create second task for cancel/reject tests', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.post(`${BASE}/tasks`, {
      headers: authHeaders(boToken),
      data: {
        title: 'Task to Cancel',
        priority: 'low',
        due_date: new Date(Date.now() + 86400000).toISOString(),
        location_name: 'Loc',
        location_lat: 10.0,
        location_lng: 106.0,
        location_radius_m: 50,
      },
    });
    const body = await res.json();
    expect(res.status()).toBe(201);
    saveState({ taskId: body.data.id }); // reuse taskId for cancel
  });

  test('Cancel task', async ({ request }) => {
    const { boToken, taskId } = loadState();
    const res = await request.patch(`${BASE}/tasks/${taskId}/cancel`, { headers: authHeaders(boToken) });
    const body = await res.json();
    console.log('Cancel task:', JSON.stringify(body).slice(0, 200));
    expect(res.status()).toBe(200);
    expect(body.data.status).toBe('cancelled');

    // Restore main task id
    const listRes = await request.get(`${BASE}/tasks?status=todo`, { headers: authHeaders(boToken) });
    const list = await listRes.json();
    if (list.data?.length > 0) saveState({ taskId: list.data[0].id });
  });

  test('Filter tasks by status', async ({ request }) => {
    const { boToken } = loadState();
    const res = await request.get(`${BASE}/tasks?status=todo`, { headers: authHeaders(boToken) });
    const body = await res.json();
    expect(res.status()).toBe(200);
    if (body.data.length > 0) {
      expect(body.data.every((t: any) => t.status === 'todo')).toBeTruthy();
    }
  });
});
