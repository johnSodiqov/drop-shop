import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { TelegramService } from './telegram.service';

@ApiTags('admin/notifications')
@ApiBearerAuth()
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Get()
  list() {
    return this.telegram.listRecent();
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.telegram.retry(id);
  }
}
