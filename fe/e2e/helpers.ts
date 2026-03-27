import { APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export const BASE = 'http://localhost:3000/api/v1';
export const STATE_FILE = path.join(__dirname, '.state.json');

export interface TestState {
  boToken: string;
  boUserId: string;
  tenantId: string;
  staffToken?: string;
  staffUserId?: string;
  taskId?: string;
  invitationId?: string;
  staffEmail?: string;
}

export function saveState(state: Partial<TestState>) {
  const existing = loadState();
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...existing, ...state }, null, 2));
}

export function loadState(): TestState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return {} as TestState;
  }
}

export async function loginAs(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${BASE}/auth/login`, {
    data: { email, password },
  });
  const body = await res.json();
  if (body.data?.access_token) return body.data.access_token;
  if (body.data?.requires_tenant_selection) {
    // multi-tenant: select first tenant
    const selRes = await request.post(`${BASE}/auth/select-tenant`, {
      data: { user_id: body.data.user.id, tenant_id: body.data.tenants[0].id },
    });
    return (await selRes.json()).data.access_token;
  }
  throw new Error(`Login failed: ${JSON.stringify(body)}`);
}

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export function multipartHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}
