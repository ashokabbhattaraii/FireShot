import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Post('users/push-token')
  pushToken(
    @CurrentUser() u: any,
    @Body() body: { token: string; platform?: string },
  ) {
    return this.users.savePushToken(u.sub, body.token, body.platform ?? 'android');
  }

  @UseGuards(JwtAuthGuard)
  @Get('leaderboard')
  leaderboard() {
    return this.users.leaderboard();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/matches')
  matches(@CurrentUser() u: any) {
    return this.users.myMatches(u.sub);
  }
}
