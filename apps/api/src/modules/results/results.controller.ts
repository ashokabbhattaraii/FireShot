import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResultsService } from './results.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StorageService } from '../../common/storage/storage.service';
import { Role } from '@fireslot/db';

@Controller('results')
export class ResultsController {
  constructor(
    private readonly svc: ResultsService,
    private readonly storage: StorageService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('screenshot'))
  async submit(
    @CurrentUser() u: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    const url = file ? (await this.storage.upload(file, 'results', 'result')).url : '';
    return this.svc.submit(u.sub, body, url);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN)
  @Get()
  list(@Query('verified') verified?: 'true' | 'false') {
    return this.svc.list(verified);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN)
  @Post(':id/verify')
  verify(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.verify(u.sub, id);
  }
}
