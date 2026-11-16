import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { OrdersService } from '../orders/orders.service';
import { AdminService } from './admin.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOrderStatusDto } from '../orders/dto/update-order-status.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly orders: OrdersService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('orders')
  ordersList(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.list(user);
  }

  @Patch('orders/:id/status')
  changeOrderStatus(
    @Param('id') id: string,
    @Body() input: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orders.changeStatus(id, input.status, user.id);
  }

  @Get('users')
  users() {
    return this.admin.listUsers();
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() input: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.updateUser(id, input, user);
  }

  @Get('agents')
  agents() {
    return this.admin.agentSales();
  }

  @Get('settings')
  settings() {
    return this.admin.settings();
  }

  @Patch('settings')
  updateSettings(@Body() input: UpdateSettingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.updateSettings(input, user.id);
  }
}
