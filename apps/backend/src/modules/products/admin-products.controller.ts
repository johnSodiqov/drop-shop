import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('admin/products')
@ApiBearerAuth()
@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.listAdmin();
  }

  @Post()
  create(@Body() input: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.products.create(input, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.update(id, input, user.id);
  }

  @Delete(':id')
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.products.archive(id, user.id);
  }
}
