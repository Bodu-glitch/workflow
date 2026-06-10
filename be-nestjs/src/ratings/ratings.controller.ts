import { Controller, Post, Get, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RatingsService } from './ratings.service.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface CurrentUserType {
  id: string;
  role: string;
  tenant_id: string | null;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private readonly service: RatingsService) {}

  @Post('requests/:requestId/rate')
  createRating(
    @Param('requestId') requestId: string,
    @Body() dto: CreateRatingDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.createRating(requestId, dto, user);
  }

  @Post('requests/:requestId/upload-review-photo')
  @UseInterceptors(FileInterceptor('photo'))
  uploadReviewPhoto(
    @Param('requestId') requestId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadReviewPhoto(requestId, file);
  }

  @Get('staff/:staffId/ratings')
  getStaffRatings(@Param('staffId') staffId: string, @Query() pagination: PaginationDto) {
    return this.service.getStaffRatings(staffId, pagination);
  }
}
