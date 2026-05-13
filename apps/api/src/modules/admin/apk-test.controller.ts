import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { PermissionsGuard, RequirePermission } from '../../common/guards/permissions.guard'
import { ApkTestService } from './apk-test.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/apk-test')
export class ApkTestController {
  constructor(private svc: ApkTestService) {}

  @RequirePermission('config', 'write')
  @Post('start')
  start(@Body() body: { buildVersion: string; deviceInfo?: any }, @CurrentUser() user: any, @Req() req: any) {
    return this.svc.startTestSession(user.sub, body.buildVersion, body.deviceInfo)
  }

  @RequirePermission('config', 'write')
  @Post(':id/bug')
  report(@Param('id') id: string, @Body() body: { title: string; description?: string; screenshotUrl?: string }, @CurrentUser() user: any) {
    return this.svc.reportBug(id, user.sub, body)
  }

  @RequirePermission('config', 'write')
  @Put(':id/end')
  end(@Param('id') id: string, @Body() body: { testNotes?: string }, @CurrentUser() user: any) {
    return this.svc.endTestSession(id, user.sub, body.testNotes)
  }

  @RequirePermission('config', 'write')
  @Get('sessions')
  sessions(@CurrentUser() user: any) {
    return this.svc.getTestSessions(user.sub)
  }

  @RequirePermission('config', 'write')
  @Get('bugs')
  bugs() {
    return this.svc.getLatestBugReports()
  }
}
