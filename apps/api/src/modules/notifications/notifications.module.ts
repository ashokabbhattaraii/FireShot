import { Controller, Get, Global, Inject, Module, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaClient } from '@fireslot/db';
import { PRISMA } from '../../prisma/prisma.module';
import { PushService } from './push.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(PRISMA) private prisma: PrismaClient) {}

  @Get()
  list(@CurrentUser() u: any) {
    return this.prisma.notification.findMany({
      where: { userId: u.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Post(':id/read')
  read(@CurrentUser() u: any, @Param('id') id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId: u.sub },
      data: { read: true },
    });
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [PushService],
  exports: [PushService],
})
export class NotificationsModule {}
