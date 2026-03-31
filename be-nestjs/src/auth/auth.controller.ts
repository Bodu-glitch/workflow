import { Controller, Post, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { AuthService } from './auth.service.js';
import { GoogleAuthDto } from './dto/google-auth.dto.js';
import { CompleteGoogleOnboardingDto } from './dto/complete-google-onboarding.dto.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

class UpdateDeviceTokenDto {
  @IsString()
  @IsOptional()
  device_token: string | null;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google')
  googleLogin(@Body() dto: GoogleAuthDto) {
    return this.authService.googleLogin(dto);
  }

  @Post('complete-google-onboarding')
  completeGoogleOnboarding(@Body() dto: CompleteGoogleOnboardingDto) {
    return this.authService.completeGoogleOnboarding(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: { id: string }) {
    return this.authService.logout(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: { id: string; tenant_id: string | null }) {
    return this.authService.getProfile(user.id, user.tenant_id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-tenant')
  createTenant(@CurrentUser() user: { id: string }, @Body() dto: CreateTenantDto) {
    return this.authService.createTenant(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('device-token')
  updateDeviceToken(@CurrentUser() user: { id: string }, @Body() dto: UpdateDeviceTokenDto) {
    return this.authService.updateDeviceToken(user.id, dto.device_token);
  }
}
