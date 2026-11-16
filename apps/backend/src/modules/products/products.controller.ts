import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query('categoryId') categoryId?: string, @Query('search') search?: string) {
    return this.products.listPublic(categoryId, search?.slice(0, 100));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.getPublic(id);
  }
}
