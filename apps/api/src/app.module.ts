import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfileModule } from './modules/profile/profile.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { ChallengesModule } from './modules/challenges/challenges.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ResultsModule } from './modules/results/results.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BotModule } from './modules/bot/bot.module';
import { SupportModule } from './modules/support/support.module';
import { AppReleasesModule } from './modules/app-releases/app-releases.module';
import { BannersModule } from './modules/banners/banners.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { CacheModule } from './common/cache/cache.module';
import { RealtimeModule } from './common/realtime/realtime.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { HealthController } from './health.controller';

const schedulerImports =
  process.env.BOT_SCHEDULER_ENABLED === 'true' ? [ScheduleModule.forRoot()] : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...schedulerImports,
    PrismaModule,
    StorageModule,
    CacheModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    ProfileModule,
    TournamentsModule,
    ChallengesModule,
    PaymentsModule,
    WalletModule,
    ResultsModule,
    NotificationsModule,
    AdminModule,
    CategoriesModule,
    BotModule,
    SupportModule,
    AppReleasesModule,
    BannersModule,
    ReferralsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
