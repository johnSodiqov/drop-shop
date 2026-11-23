import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query('categoryId') categoryId?: string, @Query('search') search?: string, @Query('department') department?: string, @Query('sort') sort?: string, @Query('attributes') attributesJson?: string) {
    let attributes: Record<string, string> | undefined;
    if (attributesJson) {
      if (attributesJson.length > 1000) throw new BadRequestException('Too many attribute filters');
      try {
        const parsed: unknown = JSON.parse(attributesJson);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some((value) => typeof value !== 'string')) throw new Error('invalid attributes');
        attributes = parsed as Record<string, string>;
        if (Object.keys(attributes).length > 10) throw new Error('too many attributes');
      } catch { throw new BadRequestException('Invalid attribute filters'); }
    }
    return this.products.listPublic(categoryId, search?.slice(0, 100), department, sort, attributes);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.getPublic(id);
  }
}
