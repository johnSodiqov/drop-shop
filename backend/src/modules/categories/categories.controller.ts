import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/create-category.dto';
import { CategoriesService } from './categories.service';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min, MinLength, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DepartmentDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) imageUrl?: string;
  @IsOptional() @IsString() imageKey?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class CreateDepartmentDto extends DepartmentDto {
  @IsString() @MinLength(2) @MaxLength(80) declare name: string;
}
class SectionDto extends DepartmentDto {
  @IsOptional() @IsString() departmentId?: string;
}
class CreateSectionDto extends SectionDto {
  @IsString() declare departmentId: string;
  @IsString() @MinLength(2) @MaxLength(80) declare name: string;
}
class CategoryAttributeDto {
  @IsString() key!: string;
  @IsString() @MinLength(1) @MaxLength(80) label!: string;
  @IsIn(['text', 'number', 'date', 'select', 'boolean']) type!: string;
  @IsBoolean() required!: boolean;
  @IsInt() @Min(0) @Max(100000) sortOrder!: number;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
}
class SetCategoryAttributesDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CategoryAttributeDto) attributes!: CategoryAttributeDto[];
}
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
  rename(@Param('id') id: string, @Body() input: UpdateCategoryDto) {
    return this.categories.rename(id, input);
  }

  @Patch(':id/attributes')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  setAttributes(@Param('id') id: string, @Body() input: SetCategoryAttributesDto) { return this.categories.setAttributes(id, input.attributes); }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }

  @Get('departments')
  departments() { return this.categories.listDepartments(); }

  @Post('departments')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  createDepartment(@Body() input: CreateDepartmentDto) { return this.categories.createDepartment(input as Required<Pick<DepartmentDto, 'name'>> & DepartmentDto); }

  @Patch('departments/:id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateDepartment(@Param('id') id: string, @Body() input: DepartmentDto) { return this.categories.updateDepartment(id, input); }

  @Post('sections')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  createSection(@Body() input: CreateSectionDto) { return this.categories.createSection(input as Required<Pick<CreateSectionDto, 'departmentId' | 'name'>> & CreateSectionDto); }

  @Patch('sections/:id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateSection(@Param('id') id: string, @Body() input: SectionDto) { return this.categories.updateSection(id, input); }
}
