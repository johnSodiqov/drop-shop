import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../../common/auth/current-user.decorator';
import { getDefaultFrontendUrl } from '../../config/environment';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly config: ConfigService,
  ) {}

  catalog(categoryId?: string, search?: string, department?: string, sort?: string, attributes?: Record<string, string>) {
    return this.products.listAgent(categoryId, search, department, sort, attributes);
  }

  product(id: string) {
    return this.products.getAgent(id);
  }

  async dashboard(user: AuthenticatedUser) {
    const orders = await this.prisma.order.findMany({
      where: { agentId: user.id },
      select: { status: true, totalAmount: true, totalProfit: true },
    });
    const active = orders.filter((order) => order.status !== OrderStatus.CANCELLED);
    const sum = (field: 'totalAmount' | 'totalProfit') =>
      active.reduce((total, order) => total.plus(order[field]), new Prisma.Decimal(0)).toFixed(2);
    return {
      ordersCount: orders.length,
      salesTotal: sum('totalAmount'),
      profit: sum('totalProfit'),
      deliveredCount: orders.filter((order) => order.status === OrderStatus.DELIVERED).length,
      cancelledCount: orders.filter((order) => order.status === OrderStatus.CANCELLED).length,
    };
  }

  async earnings(user: AuthenticatedUser) {
    const [aggregate, delivered] = await Promise.all([
      this.prisma.order.aggregate({
        where: { agentId: user.id, status: { not: OrderStatus.CANCELLED } },
        _sum: { totalProfit: true, totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: { agentId: user.id, status: OrderStatus.DELIVERED },
        _sum: { totalProfit: true },
      }),
    ]);
    return {
      ordersCount: aggregate._count._all,
      salesTotal: aggregate._sum.totalAmount?.toFixed(2) ?? '0.00',
      profit: aggregate._sum.totalProfit?.toFixed(2) ?? '0.00',
      deliveredProfit: delivered._sum.totalProfit?.toFixed(2) ?? '0.00',
    };
  }

  async personalLinks(user: AuthenticatedUser) {
    const profile = await this.prisma.agentProfile.findUnique({ where: { userId: user.id } });
    if (!profile) throw new NotFoundException('Agent profile is unavailable');
    const frontend = this.config.get<string>('FRONTEND_URL')
      ?? getDefaultFrontendUrl(this.config.get<string>('NODE_ENV'));
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, inventory: { is: { quantity: { gt: 0 } } } },
      select: { id: true, name: true, imageUrl: true },
      orderBy: { name: 'asc' },
    });
    return products.map((product) => ({
      ...product,
      url: `${frontend}/products/${product.id}?ref=${encodeURIComponent(profile.referralCode)}`,
    }));
  }
}
