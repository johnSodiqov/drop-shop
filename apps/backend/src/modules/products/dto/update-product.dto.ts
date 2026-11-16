import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
