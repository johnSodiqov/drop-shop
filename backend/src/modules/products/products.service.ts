import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const productSelection = {
  inventory: { select: { quantity: true } },
  category: { select: { id: true, name: true, slug: true, department: { select: { id: true, name: true, slug: true } }, section: { select: { id: true, name: true, slug: true } }, parent: { select: { id: true, name: true, slug: true } }, attributes: { orderBy: { sortOrder: 'asc' } } } },
} as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(categoryId?: string, search?: string, departmentSlug?: string, sort?: string, attributes?: Record<string, string>, sectionSlug?: string) {
    const department = departmentSlug ? await this.prisma.department.findUnique({ where: { slug: departmentSlug }, select: { id: true } }) : null;
    if (departmentSlug && !department) throw new NotFoundException('Department not found');
    const section = sectionSlug ? await this.prisma.catalogSection.findUnique({ where: { slug: sectionSlug }, select: { id: true, departmentId: true } }) : null;
    if (sectionSlug && (!section || (department && section.departmentId !== department.id))) throw new NotFoundException('Section not found');
    const attributeDefinitions = attributes ? await this.prisma.categoryAttribute.findMany({ where: { key: { in: Object.keys(attributes) }, ...(categoryId ? { categoryId } : section ? { category: { sectionId: section.id } } : department ? { category: { departmentId: department.id } } : {}) }, select: { key: true, type: true } }) : [];
    const attributeTypes = new Map(attributeDefinitions.map((definition) => [definition.key, definition.type]));
    const products = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        inventory: { is: { quantity: { gt: 0 } } },
        ...(categoryId ? { categoryId } : {}),
        category: { isActive: true, department: { isActive: true }, ...(department ? { departmentId: department.id } : {}), ...(section ? { sectionId: section.id } : {}) },
        ...(attributes ? { AND: Object.entries(attributes).map(([key, value]) => ({ attributes: { path: [key], equals: attributeTypes.get(key) === 'number' && value !== '' ? Number(value) : value } })) } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: productSelection,
      orderBy: sort === 'price-asc' ? { recommendedPrice: 'asc' } : sort === 'price-desc' ? { recommendedPrice: 'desc' } : sort === 'name' ? { name: 'asc' } : { createdAt: 'desc' },
    });
    return products.map(({ costPrice: _cost, minimumPrice: _minimum, maximumMarkup: _markup, allowAgentPriceChange: _editable, ...product }) => product);
  }

  async getPublic(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, status: ProductStatus.ACTIVE, category: { isActive: true, department: { isActive: true } } },
      include: productSelection,
    });
    if (!product) throw new NotFoundException('Product not found');
    const { costPrice: _cost, minimumPrice: _minimum, maximumMarkup: _markup, allowAgentPriceChange: _editable, ...publicProduct } = product;
    return publicProduct;
  }

  async listAgent(categoryId?: string, search?: string, departmentSlug?: string, sort?: string, attributes?: Record<string, string>, sectionSlug?: string) {
    const department = departmentSlug ? await this.prisma.department.findUnique({ where: { slug: departmentSlug }, select: { id: true } }) : null;
    if (departmentSlug && !department) throw new NotFoundException('Department not found');
    const section = sectionSlug ? await this.prisma.catalogSection.findUnique({ where: { slug: sectionSlug }, select: { id: true, departmentId: true } }) : null;
    if (sectionSlug && (!section || (department && section.departmentId !== department.id))) throw new NotFoundException('Section not found');
    const definitions = attributes ? await this.prisma.categoryAttribute.findMany({ where: { key: { in: Object.keys(attributes) }, ...(categoryId ? { categoryId } : section ? { category: { sectionId: section.id } } : department ? { category: { departmentId: department.id } } : {}) }, select: { key: true, type: true } }) : [];
    const types = new Map(definitions.map((definition) => [definition.key, definition.type]));
    return this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        inventory: { is: { quantity: { gt: 0 } } },
        ...(categoryId ? { categoryId } : {}),
        category: { isActive: true, department: { isActive: true }, ...(department ? { departmentId: department.id } : {}), ...(section ? { sectionId: section.id } : {}) },
        ...(attributes ? { AND: Object.entries(attributes).map(([key, value]) => ({ attributes: { path: [key], equals: types.get(key) === 'number' ? Number(value) : value } })) } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: productSelection,
      orderBy: sort === 'price-asc' ? { recommendedPrice: 'asc' } : sort === 'price-desc' ? { recommendedPrice: 'desc' } : sort === 'name' ? { name: 'asc' } : { createdAt: 'desc' },
    });
  }

  async getAgent(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, status: ProductStatus.ACTIVE, inventory: { is: { quantity: { gt: 0 } } }, category: { isActive: true, department: { isActive: true } } },
      include: productSelection,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async listAdmin() {
    return this.prisma.product.findMany({
      where: { status: { not: ProductStatus.ARCHIVED } },
      include: productSelection,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: CreateProductDto, actorId: string) {
    this.validatePricing(input.costPrice, input.minimumPrice, input.recommendedPrice, input.maximumMarkup);
    await this.validateAttributes(input.categoryId, input.attributes);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            sku: input.sku.trim(),
            name: input.name.trim(),
            description: input.description.trim(),
            categoryId: input.categoryId,
            attributes: input.attributes as Prisma.InputJsonValue | undefined,
            costPrice: new Prisma.Decimal(input.costPrice),
            recommendedPrice: new Prisma.Decimal(input.recommendedPrice),
            minimumPrice: new Prisma.Decimal(input.minimumPrice),
            maximumMarkup: new Prisma.Decimal(input.maximumMarkup),
            imageUrl: input.imageUrl,
            imageUrls: input.imageUrls ?? [],
            imageKeys: input.imageKeys ?? [],
            allowAgentPriceChange: input.allowAgentPriceChange ?? true,
            status: input.stock > 0 ? ProductStatus.ACTIVE : ProductStatus.OUT_OF_STOCK,
            inventory: { create: { quantity: input.stock } },
          },
          include: productSelection,
        });
        if (input.stock > 0) {
          await tx.inventoryMovement.create({
            data: {
              productId: product.id,
              quantity: input.stock,
              reason: `Initial stock set by ${actorId}`,
            },
          });
        }
        await tx.auditLog.create({
          data: { userId: actorId, action: 'PRODUCT_CREATED', target: product.id },
        });
        return product;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('A product with this SKU already exists');
      throw error;
    }
  }

  async update(id: string, input: UpdateProductDto, actorId: string) {
    const current = await this.prisma.product.findUnique({
      where: { id },
      include: { inventory: true },
    });
    if (!current) throw new NotFoundException('Product not found');

    const cost = input.costPrice ?? current.costPrice.toString();
    const minimum = input.minimumPrice ?? current.minimumPrice.toString();
    const recommended = input.recommendedPrice ?? current.recommendedPrice.toString();
    const markup = input.maximumMarkup ?? current.maximumMarkup.toString();
    this.validatePricing(cost, minimum, recommended, markup);
    if (input.categoryId !== undefined || input.attributes !== undefined) {
      const currentAttributes = current.attributes && typeof current.attributes === 'object' && !Array.isArray(current.attributes)
        ? current.attributes as Record<string, unknown>
        : undefined;
      await this.validateAttributes(input.categoryId ?? current.categoryId, input.attributes ?? currentAttributes);
    }
    const resultingStock = input.stock ?? current.inventory?.quantity ?? 0;
    if (input.status === ProductStatus.ACTIVE && resultingStock === 0) {
      throw new BadRequestException('A product with no stock cannot be activated');
    }
    if (input.status === ProductStatus.OUT_OF_STOCK && resultingStock > 0) {
      throw new BadRequestException('A stocked product cannot be marked out of stock');
    }

    const data: Prisma.ProductUpdateInput = {
      ...(input.sku !== undefined ? { sku: input.sku.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.categoryId !== undefined ? { category: { connect: { id: input.categoryId } } } : {}),
      ...(input.attributes !== undefined ? { attributes: input.attributes as Prisma.InputJsonValue } : {}),
      ...(input.costPrice !== undefined ? { costPrice: new Prisma.Decimal(cost) } : {}),
      ...(input.recommendedPrice !== undefined ? { recommendedPrice: new Prisma.Decimal(recommended) } : {}),
      ...(input.minimumPrice !== undefined ? { minimumPrice: new Prisma.Decimal(minimum) } : {}),
      ...(input.maximumMarkup !== undefined ? { maximumMarkup: new Prisma.Decimal(markup) } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.imageUrls !== undefined ? { imageUrls: input.imageUrls } : {}),
      ...(input.imageKeys !== undefined ? { imageKeys: input.imageKeys } : {}),
      ...(input.allowAgentPriceChange !== undefined ? { allowAgentPriceChange: input.allowAgentPriceChange } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.stock !== undefined && input.stock !== current.inventory?.quantity) {
          const previous = current.inventory?.quantity ?? 0;
          await tx.inventory.upsert({
            where: { productId: id },
            create: { productId: id, quantity: input.stock },
            update: { quantity: input.stock },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: id,
              quantity: input.stock - previous,
              reason: `Stock adjusted by ${actorId}`,
            },
          });
          if (input.status === ProductStatus.HIDDEN || input.status === ProductStatus.ARCHIVED) {
            data.status = input.status;
          } else if (input.stock === 0 && current.status !== ProductStatus.ARCHIVED) {
            data.status = ProductStatus.OUT_OF_STOCK;
          } else if (current.status === ProductStatus.OUT_OF_STOCK && input.stock !== undefined && input.stock > 0) {
            data.status = ProductStatus.ACTIVE;
          }
        }
        const product = await tx.product.update({
          where: { id },
          data,
          include: productSelection,
        });
        await tx.auditLog.create({
          data: { userId: actorId, action: 'PRODUCT_UPDATED', target: id },
        });
        return product;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('A product with this SKU already exists');
      throw error;
    }
  }

  async archive(id: string, actorId: string): Promise<{ success: true }> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.$transaction([
      this.prisma.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED } }),
      this.prisma.auditLog.create({
        data: { userId: actorId, action: 'PRODUCT_ARCHIVED', target: id },
      }),
    ]);
    return { success: true };
  }

  private validatePricing(cost: string, minimum: string, recommended: string, markup: string): void {
    const costValue = new Prisma.Decimal(cost);
    const minValue = new Prisma.Decimal(minimum);
    const recommendedValue = new Prisma.Decimal(recommended);
    const maxValue = costValue.plus(markup);
    if (costValue.isNegative() || minValue.lessThan(costValue) || recommendedValue.lessThan(minValue) || recommendedValue.greaterThan(maxValue)) {
      throw new BadRequestException('Prices must satisfy cost ≤ minimum ≤ recommended ≤ cost + maximum markup');
    }
  }

  private async validateAttributes(categoryId: string, values?: Record<string, unknown>) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { attributes: true } });
    if (!category) throw new NotFoundException('Category not found');
    const safeValues = values ?? {};
    const definitions = category.attributes;
    const allowed = new Set(definitions.map((definition) => definition.key));
    if (Object.keys(safeValues).some((key) => !allowed.has(key))) throw new BadRequestException('Product contains attributes not configured for its category');
    for (const definition of definitions) {
      const value = safeValues[definition.key];
      if ((value === undefined || value === null || value === '') && definition.required) throw new BadRequestException(`${definition.label} is required`);
      if (value === undefined || value === null || value === '') continue;
      const valid = definition.type === 'text' ? typeof value === 'string' && value.length <= 500
        : definition.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
        : definition.type === 'boolean' ? typeof value === 'boolean'
        : definition.type === 'date' ? typeof value === 'string' && !Number.isNaN(Date.parse(value))
        : definition.type === 'select' ? typeof value === 'string' && Array.isArray(definition.options) && definition.options.includes(value)
        : false;
      if (!valid) throw new BadRequestException(`${definition.label} has an invalid value`);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
