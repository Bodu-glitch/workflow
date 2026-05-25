import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthModule } from '../auth/auth.module.js';
import { MeController, StaffProfileController } from './me.controller.js';
import { MeService } from './me.service.js';

@Module({
  imports: [
    AuthModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [MeController, StaffProfileController],
  providers: [MeService],
})
export class MeModule {}
