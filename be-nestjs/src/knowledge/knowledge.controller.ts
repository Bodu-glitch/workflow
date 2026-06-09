import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

interface CurrentUserType {
  id: string;
  role: string;
  tenant_id: string;
}

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  /** GET /knowledge — staff: tìm kiếm bài viết */
  @Get()
  @UseGuards(JwtAuthGuard)
  searchArticles(
    @CurrentUser() user: CurrentUserType,
    @Query('q') q?: string,
    @Query('category_id') category_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.knowledgeService.searchArticles({
      q,
      category_id,
      tenant_id: user.tenant_id,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  /** GET /knowledge/:id — chi tiết bài viết */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getArticle(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.knowledgeService.getArticle(id, user.tenant_id);
  }

  /** POST /knowledge — BO/OT: tạo bài viết */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  createArticle(@CurrentUser() user: CurrentUserType, @Body() dto: CreateArticleDto) {
    return this.knowledgeService.createArticle(user, dto);
  }

  /** PATCH /knowledge/:id — BO/OT: cập nhật */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  updateArticle(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Body() dto: Partial<CreateArticleDto>,
  ) {
    return this.knowledgeService.updateArticle(id, user, dto);
  }

  /** DELETE /knowledge/:id — BO/OT: xóa */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  deleteArticle(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.knowledgeService.deleteArticle(id, user);
  }
}
