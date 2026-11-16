import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { OrdersService } from '../orders/orders.service';
import { AgentService } from './agent.service';

@ApiTags('agent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENT)
@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly orders: OrdersService,
  ) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.agent.dashboard(user);
  }

  @Get('catalog')
  catalog(@Query('categoryId') categoryId?: string, @Query('search') search?: string) {
    return this.agent.catalog(categoryId, search?.slice(0, 100));
  }

  @Get('catalog/:id')
  product(@Param('id') id: string) {
    return this.agent.product(id);
  }

  @Get('orders')
  ordersList(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.list(user);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: AuthenticatedUser) {
    return this.agent.earnings(user);
  }

  @Get('links')
  links(@CurrentUser() user: AuthenticatedUser) {
    return this.agent.personalLinks(user);
  }
}
