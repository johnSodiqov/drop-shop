import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async create(input: CreateCategoryDto) {
    const name = input.name.trim();
    const slugBase = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    try {
      return await this.prisma.category.create({
        data: { name, slug: `${slugBase || 'category'}-${randomUUID().slice(0, 8)}` },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Category already exists');
      throw error;
    }
  }

  async rename(id: string, input: CreateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return this.prisma.category.update({
      where: { id },
      data: { name: input.name.trim() },
    });
  }

  async remove(id: string): Promise<{ success: true }> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (category._count.products) {
      throw new ConflictException('Move or remove this category’s products first');
    }
    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
