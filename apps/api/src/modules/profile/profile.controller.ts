import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ProfileService, UpsertProfileDto } from './profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly svc: ProfileService) {}

  @Get() get(@CurrentUser() u: any) {
    return this.svc.get(u.sub);
  }

  @Put() upsert(@CurrentUser() u: any, @Body() dto: UpsertProfileDto) {
    return this.svc.upsert(u.sub, dto);
  }
}
