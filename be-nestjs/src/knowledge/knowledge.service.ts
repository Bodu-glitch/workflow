import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateArticleDto } from './dto/create-article.dto.js';

interface CurrentUser {
  id: string;
  role: string;
  tenant_id: string | null;
}

@Injectable()
export class KnowledgeService {
  constructor(private supabase: SupabaseService) {}

  /** Staff: tìm kiếm bài viết */
  async searchArticles(params: {
    q?: string;
    category_id?: string;
    tenant_id?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = this.supabase.db
      .from('knowledge_base')
      .select('id, title, tags, media_urls, sort_order, view_count, category:category_id(id, name, slug), created_at', { count: 'exact' })
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Hiện bài global (tenant_id IS NULL) hoặc bài của tenant
    if (params.tenant_id) {
      query = query.or(`tenant_id.is.null,tenant_id.eq.${params.tenant_id}`);
    } else {
      query = query.is('tenant_id', null);
    }

    if (params.category_id) {
      query = query.eq('category_id', params.category_id);
    }

    if (params.q) {
      query = query.or(`title.ilike.%${params.q}%,content.ilike.%${params.q}%,tags.cs.{${params.q}}`);
    }

    const { data, count, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  /** Staff: chi tiết bài viết + tăng view_count */
  async getArticle(id: string, tenantId?: string) {
    const { data, error } = await this.supabase.db
      .from('knowledge_base')
      .select('*, category:category_id(id, name, slug, icon_url)')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) throw new NotFoundException('Bài viết không tồn tại');

    // Access check: bài global hoặc bài của tenant
    if (data.tenant_id && tenantId && data.tenant_id !== tenantId) {
      throw new ForbiddenException();
    }

    // Tăng view count (fire and forget)
    this.supabase.db
      .from('knowledge_base')
      .update({ view_count: (data.view_count ?? 0) + 1 })
      .eq('id', id)
      .then(() => {});

    return data;
  }

  /** BO/OT: tạo bài viết */
  async createArticle(user: CurrentUser, dto: CreateArticleDto) {
    const { data, error } = await this.supabase.db
      .from('knowledge_base')
      .insert({
        tenant_id: user.tenant_id,
        category_id: dto.category_id ?? null,
        title: dto.title.trim(),
        content: dto.content,
        tags: dto.tags ?? [],
        media_urls: dto.media_urls ?? [],
        sort_order: dto.sort_order ?? 0,
        is_active: dto.is_active ?? true,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** BO/OT: cập nhật bài viết */
  async updateArticle(id: string, user: CurrentUser, dto: Partial<CreateArticleDto>) {
    const { data: existing } = await this.supabase.db
      .from('knowledge_base')
      .select('tenant_id')
      .eq('id', id)
      .single();

    if (!existing) throw new NotFoundException('Bài viết không tồn tại');
    if (existing.tenant_id !== user.tenant_id) throw new ForbiddenException();

    const { data, error } = await this.supabase.db
      .from('knowledge_base')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** BO/OT: xóa (soft delete) */
  async deleteArticle(id: string, user: CurrentUser) {
    const { data: existing } = await this.supabase.db
      .from('knowledge_base')
      .select('tenant_id')
      .eq('id', id)
      .single();

    if (!existing) throw new NotFoundException('Bài viết không tồn tại');
    if (existing.tenant_id !== user.tenant_id) throw new ForbiddenException();

    await this.supabase.db.from('knowledge_base').update({ is_active: false }).eq('id', id);
    return { message: 'Bài viết đã được xóa' };
  }
}
