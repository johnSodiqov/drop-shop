import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma, ProductStatus, UserRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuthenticatedUser } from '../../common/auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async dashboard() {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'lowStockThreshold' } });
    const lowStockThreshold = Number(setting?.value ?? this.config.get('LOW_STOCK_THRESHOLD', '5'));
    const salesFilter = { status: { not: OrderStatus.CANCELLED } } as const;
    const [
      productsCount,
      ordersCount,
      activeAgentsCount,
      sales,
      newOrdersCount,
      lowStockProducts,
      topProductGroups,
      topAgentGroups,
    ] = await Promise.all([
      this.prisma.product.count({ where: { status: { not: ProductStatus.ARCHIVED } } }),
      this.prisma.order.count(),
      this.prisma.user.count({ where: { role: UserRole.AGENT, isActive: true } }),
      this.prisma.order.aggregate({ where: salesFilter, _sum: { totalAmount: true } }),
      this.prisma.order.count({ where: { status: OrderStatus.NEW } }),
      this.prisma.product.findMany({
        where: { status: { not: ProductStatus.ARCHIVED }, inventory: { is: { quantity: { lte: lowStockThreshold } } } },
        include: { inventory: true },
        orderBy: { inventory: { quantity: 'asc' } },
        take: 10,
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { status: { not: OrderStatus.CANCELLED } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      this.prisma.order.groupBy({
        by: ['agentId'],
        where: { agentId: { not: null }, status: { not: OrderStatus.CANCELLED } },
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
    ]);

    const productIds = topProductGroups.map((row) => row.productId);
    const agentIds = topAgentGroups.flatMap((row) => row.agentId ? [row.agentId] : []);
    const [topProducts, topAgents] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true } }),
      this.prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, phone: true } }),
    ]);
    const productsById = new Map(topProducts.map((product) => [product.id, product]));
    const agentsById = new Map(topAgents.map((agent) => [agent.id, agent]));

    return {
      productsCount,
      ordersCount,
      activeAgentsCount,
      salesTotal: sales._sum.totalAmount?.toFixed(2) ?? '0.00',
      newOrdersCount,
      lowStockProducts,
      topProducts: topProductGroups.map((row) => ({
        ...productsById.get(row.productId),
        sold: row._sum.quantity ?? 0,
      })),
      topAgents: topAgentGroups.flatMap((row) => {
        const agent = row.agentId ? agentsById.get(row.agentId) : undefined;
        return agent ? [{ ...agent, sales: row._sum.totalAmount?.toFixed(2) ?? '0.00' }] : [];
      }),
    };
  }

  listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        agentProfile: { select: { referralCode: true } },
        _count: { select: { agentOrders: true, customerOrders: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async updateUser(id: string, input: UpdateUserDto, actor: AuthenticatedUser) {
    if (actor.id === id && (input.role !== undefined || input.isActive === false)) {
      throw new BadRequestException('You cannot change your own role or disable your account');
    }
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('User not found');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        select: { id: true, phone: true, name: true, role: true, isActive: true },
      });
      if (input.role === UserRole.AGENT && current.role !== UserRole.AGENT) {
        await tx.agentProfile.upsert({
          where: { userId: id },
          create: {
            userId: id,
            referralCode: randomBytes(8).toString('hex'),
          },
          update: {},
        });
      }
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'USER_UPDATED',
          target: id,
          details: input as Prisma.InputJsonValue,
        },
      });
      return user;
    });
  }

  async settings() {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'lowStockThreshold' } });
    return {
      lowStockThreshold: Number(setting?.value ?? this.config.get('LOW_STOCK_THRESHOLD', '5')),
      telegramConfigured: Boolean(
        this.config.get('TELEGRAM_BOT_TOKEN') && this.config.get('TELEGRAM_ADMIN_CHAT_ID'),
      ),
    };
  }

  async updateSettings(input: UpdateSettingDto, actorId: string) {
    const value = String(input.lowStockThreshold);
    await this.prisma.$transaction([
      this.prisma.setting.upsert({
        where: { key: 'lowStockThreshold' },
        create: { key: 'lowStockThreshold', value },
        update: { value },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'PLATFORM_SETTINGS_UPDATED',
          target: 'settings',
          details: { lowStockThreshold: input.lowStockThreshold },
        },
      }),
    ]);
    return this.settings();
  }

  async agentSales() {
    const groups = await this.prisma.order.groupBy({
      by: ['agentId'],
      where: { agentId: { not: null }, status: { not: OrderStatus.CANCELLED } },
      _sum: { totalAmount: true, totalProfit: true },
      _count: { _all: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
    });
    const ids = groups.flatMap((group) => group.agentId ? [group.agentId] : []);
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, phone: true, isActive: true },
    });
    const userMap = new Map(users.map((user) => [user.id, user]));
    return groups.flatMap((group) => {
      const user = group.agentId ? userMap.get(group.agentId) : undefined;
      return user
        ? [{
            ...user,
            ordersCount: group._count._all,
            sales: group._sum.totalAmount?.toFixed(2) ?? '0.00',
            profit: group._sum.totalProfit?.toFixed(2) ?? '0.00',
          }]
        : [];
    });
  }
}
