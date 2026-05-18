import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware.js';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SupabaseModule } from './supabase/supabase.module.js';
import { EmailModule } from './email/email.module.js';
// Existing modules
import { AuthModule } from './auth/auth.module.js';
import { AdminModule } from './admin/admin.module.js';
import { StaffModule } from './staff/staff.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { MeModule } from './me/me.module.js';
import { AuditModule } from './audit/audit.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { TenantModule } from './tenant/tenant.module.js';
// New rescue platform modules
import { CategoriesModule } from './categories/categories.module.js';
import { MatchingModule } from './matching/matching.module.js';
import { RequestsModule } from './requests/requests.module.js';
import { TechnicianModule } from './technician/technician.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { RatingsModule } from './ratings/ratings.module.js';
import { ChatModule } from './chat/chat.module.js';
import { GatewayModule } from './gateway/gateway.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    EmailModule,
    // Existing modules (unchanged)
    AuthModule,
    AdminModule,
    StaffModule,
    TasksModule,
    MeModule,
    AuditModule,
    NotificationsModule,
    TenantModule,
    // New modules
    CategoriesModule,
    MatchingModule,
    RequestsModule,
    TechnicianModule,
    PricingModule,
    RatingsModule,
    ChatModule,
    GatewayModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
