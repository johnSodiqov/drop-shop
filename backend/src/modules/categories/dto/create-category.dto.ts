import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, Min, MaxLength, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imageKey?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
