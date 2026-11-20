import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { TelegramService } from './telegram.service';

@ApiTags('admin/telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/telegram')
export class TelegramAdminController {
  constructor(private readonly telegram: TelegramService) {}

  @Get('link')
  linkStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.telegram.adminLinkStatus(user.id);
  }

  @Post('link-code')
  createLinkCode(@CurrentUser() user: AuthenticatedUser) {
    return this.telegram.issueAdminLinkCode(user.id);
  }

  @Delete('link')
  unlink(@CurrentUser() user: AuthenticatedUser) {
    return this.telegram.unlinkAdminAccount(user.id);
  }

  @Post('webhook')
  registerWebhook(@Body('url') url: string) {
    return this.telegram.registerWebhook(url);
  }
}
