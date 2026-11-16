import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  create(@Body() input: CreateCategoryDto) {
    return this.categories.create(input);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  rename(@Param('id') id: string, @Body() input: CreateCategoryDto) {
    return this.categories.rename(id, input);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
