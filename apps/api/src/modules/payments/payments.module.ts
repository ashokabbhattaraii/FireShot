import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AdminModule } from '../admin/admin.module';
import { ReferralsModule } from '../referrals/referrals.module';

@Module({
  imports: [
    AdminModule,
    ReferralsModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
