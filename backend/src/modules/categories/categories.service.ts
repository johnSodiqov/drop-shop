import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      orderBy: [{ department: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { department: true, parent: true, attributes: { orderBy: { sortOrder: 'asc' } }, _count: { select: { products: true, children: true } } },
    });
  }

  listDepartments() {
    return this.prisma.department.findMany({ orderBy: { sortOrder: 'asc' }, include: { categories: { orderBy: { sortOrder: 'asc' }, include: { _count: { select: { products: true } } } } } });
  }

  async setAttributes(categoryId: string, attributes: Array<{ key: string; label: string; type: string; required: boolean; sortOrder: number; options?: unknown }>) {
    if (!(await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) throw new NotFoundException('Category not found');
    const keys = attributes.map((attribute) => attribute.key);
    if (attributes.length > 30 || new Set(keys).size !== keys.length || attributes.some((attribute) => !/^[a-z][a-zA-Z0-9_]{0,39}$/.test(attribute.key) || !['text', 'number', 'date', 'select', 'boolean'].includes(attribute.type) || (attribute.type === 'select' && (!Array.isArray(attribute.options) || attribute.options.length === 0)))) throw new ConflictException('Use unique attribute keys, supported types, and options for select fields');
    return this.prisma.$transaction(async (tx) => {
      await tx.categoryAttribute.deleteMany({ where: { categoryId } });
      if (attributes.length) await tx.categoryAttribute.createMany({ data: attributes.map((attribute) => ({ categoryId, ...attribute, options: attribute.options as Prisma.InputJsonValue | undefined })) });
      return tx.categoryAttribute.findMany({ where: { categoryId }, orderBy: { sortOrder: 'asc' } });
    });
  }

  async create(input: CreateCategoryDto) {
    const name = input.name.trim();
    const slugBase = this.slug(name) || 'category';
    try {
      const departmentId = input.departmentId ?? 'dept_home';
      const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
      if (!department) throw new NotFoundException('Department not found');
      if (input.parentId) await this.assertParent(input.parentId, departmentId);
      return await this.prisma.category.create({
        data: {
          name,
          slug: (await this.prisma.category.findUnique({ where: { slug: slugBase }, select: { id: true } })) ? `${slugBase}-${randomUUID().slice(0, 8)}` : slugBase,
          departmentId,
          parentId: input.parentId ?? null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
          imageUrl: input.imageUrl,
          imageKey: input.imageKey,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Category already exists');
      throw error;
    }
  }

  async rename(id: string, input: Partial<CreateCategoryDto>) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    const departmentId = input.departmentId ?? category.departmentId;
    if (input.departmentId && !(await this.prisma.department.findUnique({ where: { id: departmentId } }))) throw new NotFoundException('Department not found');
    const parentId = input.parentId === undefined ? category.parentId : input.parentId;
    if (parentId) await this.assertParent(parentId, departmentId, id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          departmentId,
          parentId,
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          ...(input.imageKey !== undefined ? { imageKey: input.imageKey } : {}),
        },
      });
      if (departmentId !== category.departmentId || input.isActive !== undefined) {
        let frontier = [id];
        const descendants: string[] = [];
        while (frontier.length) {
          const children = await tx.category.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
          frontier = children.map((child) => child.id);
          descendants.push(...frontier);
        }
        if (descendants.length) await tx.category.updateMany({ where: { id: { in: descendants } }, data: { ...(departmentId !== category.departmentId ? { departmentId } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) } });
      }
      return updated;
    });
  }

  async createDepartment(input: { name: string; slug?: string; description?: string; imageUrl?: string; imageKey?: string; sortOrder?: number }) {
    const slug = input.slug ?? this.slug(input.name);
    return this.prisma.department.create({ data: { ...input, name: input.name.trim(), slug } });
  }

  async updateDepartment(id: string, input: { name?: string; slug?: string; description?: string; imageUrl?: string; imageKey?: string; sortOrder?: number; isActive?: boolean }) {
    if (!(await this.prisma.department.findUnique({ where: { id } }))) throw new NotFoundException('Department not found');
    return this.prisma.department.update({ where: { id }, data: { ...input, ...(input.name ? { name: input.name.trim() } : {}) } });
  }

  private slug(name: string) { return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[а-яё]/gi, c => ({ а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' }[c.toLowerCase()] ?? c)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  private async assertParent(parentId: string, departmentId: string, currentId?: string) {
    if (parentId === currentId) throw new ConflictException('A category cannot be its own parent');
    const parent = await this.prisma.category.findUnique({ where: { id: parentId }, select: { id: true, departmentId: true, parentId: true } });
    if (!parent || parent.departmentId !== departmentId) throw new ConflictException('Parent category must belong to the same department');
    if (currentId) { let ancestor: typeof parent | null = parent; while (ancestor) { if (ancestor.id === currentId) throw new ConflictException('Category hierarchy cannot contain a cycle'); ancestor = ancestor.parentId ? await this.prisma.category.findUnique({ where: { id: ancestor.parentId }, select: { id: true, departmentId: true, parentId: true } }) : null; } }
  }

  async remove(id: string): Promise<{ success: true }> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (category._count.products) {
      throw new ConflictException('Move or remove this category’s products first');
    }
    if (category._count.children) throw new ConflictException('Move or remove child categories first');
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
