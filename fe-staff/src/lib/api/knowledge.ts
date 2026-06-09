import { apiFetch } from './client';

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  tags: string[] | null;
  media_urls: string[] | null;
  category?: { id: string; name: string } | null;
  tenant?: { id: string; name: string } | null;
  created_at: string;
}

export const knowledgeApi = {
  search: (q?: string, category_id?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category_id) params.set('category_id', category_id);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<{ data: KnowledgeArticle[] }>(`/knowledge${qs}`);
  },

  getArticle: (id: string) =>
    apiFetch<{ data: KnowledgeArticle }>(`/knowledge/${id}`),
};
