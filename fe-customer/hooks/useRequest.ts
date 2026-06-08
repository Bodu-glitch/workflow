import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from './useAuth';
import { useSocket } from './useSocket';
import type { ServiceRequest, CategoryMatch } from '../types';

export function useRequests() {
  const { user, token } = useAuth();
  const { onStatusChange } = useSocket(token);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get<ServiceRequest[]>('/requests');
      setRequests(res ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-time status updates from server via customerRoom
  useEffect(() => {
    const off = onStatusChange((data) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === data.requestId ? { ...r, status: data.status as ServiceRequest['status'] } : r,
        ),
      );
    });
    return off;
  }, [onStatusChange]);

  return { requests, loading, error, refresh: fetchRequests };
}

export function useRequest(id: string | null) {
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequest = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<ServiceRequest>(`/requests/${id}`);
      setRequest(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  return { request, setRequest, loading, error, refresh: fetchRequest };
}

export async function matchCategories(description: string): Promise<CategoryMatch[]> {
  const res = await api.post<{ suggestions: CategoryMatch[] }>('/requests/match-categories', { description });
  return res.suggestions;
}
