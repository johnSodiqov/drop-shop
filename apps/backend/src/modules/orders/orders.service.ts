import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { InventoryService } from '../inventory/inventory.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateOrderDto } from './dto/create-order.dto';

const transitions: Record<OrderStatus, OrderStatus[]> = {
  NEW: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PACKING, OrderStatus.CANCELLED],
  PACKING: [OrderStatus.DELIVERY, OrderStatus.CANCELLED],
  DELIVERY: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly inventoryService: InventoryService,
    private readonly pricingService: PricingService,
  ) {}

  async create(input: CreateOrderDto, user: AuthenticatedUser) {
    const merged = new Map<string, { quantity: number; salePrice?: string }>();
    for (const line of input.items) {
      const current = merged.get(line.productId);
      if (current) {
        current.quantity += line.quantity;
        if (line.salePrice && current.salePrice && line.salePrice !== current.salePrice) {
          throw new BadRequestException('Duplicate product lines must use the same sale price');
        }
        current.salePrice ??= line.salePrice;
      } else {
        merged.set(line.productId, { quantity: line.quantity, salePrice: line.salePrice });
      }
    }

    if (user.role !== UserRole.AGENT && [...merged.values()].some((line) => line.salePrice !== undefined)) {
      throw new BadRequestException('Only agents may provide a sale price');
    }

    try {
      const order = await this.prisma.$transaction(
        async (tx) => {
          if (input.idempotencyKey) {
            const existing = await tx.order.findUnique({
              where: { idempotencyKey: input.idempotencyKey },
              include: { items: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
            });
            if (existing) {
              if (existing.customerId !== user.id && existing.agentId !== user.id) {
                throw new ConflictException('Idempotency key has already been used');
              }
              return existing;
            }
          }

          const products = await tx.product.findMany({
            where: {
              id: { in: [...merged.keys()] },
              status: ProductStatus.ACTIVE,
            },
            include: { inventory: true },
          });
          if (products.length !== merged.size) {
            throw new BadRequestException('One or more products are unavailable');
          }

          const lines: Array<{
            productId: string;
            productName: string;
            sku: string;
            quantity: number;
            costPrice: Prisma.Decimal;
            salePrice: Prisma.Decimal;
            profit: Prisma.Decimal;
          }> = [];
          let totalAmount = new Prisma.Decimal(0);
          let totalCost = new Prisma.Decimal(0);
          let totalProfit = new Prisma.Decimal(0);

          let assignedAgentId: string | undefined =
            user.role === UserRole.AGENT ? user.id : undefined;
          if (user.role === UserRole.CUSTOMER && input.agentCode) {
            const referral = await tx.agentProfile.findUnique({
              where: { referralCode: input.agentCode },
              include: { user: { select: { id: true, role: true, isActive: true } } },
            });
            if (!referral || referral.user.role !== UserRole.AGENT || !referral.user.isActive) {
              throw new BadRequestException('The referral link is invalid or inactive');
            }
            assignedAgentId = referral.userId;
          }

          for (const product of products) {
            const requested = merged.get(product.id)!;
            if (!product.inventory || product.inventory.quantity < requested.quantity) {
              throw new ConflictException(`Insufficient stock for ${product.name}`);
            }
            const costPrice = product.costPrice;
            let salePrice = product.recommendedPrice;
            let profitPerUnit = new Prisma.Decimal(0);
            if (user.role === UserRole.AGENT) {
              const pricing = this.pricingService.forAgent({
                cost: costPrice,
                minimum: product.minimumPrice,
                recommended: product.recommendedPrice,
                maximumMarkup: product.maximumMarkup,
                allowAgentPriceChange: product.allowAgentPriceChange,
                requested: requested.salePrice,
              });
              salePrice = pricing.salePrice;
              profitPerUnit = pricing.profit;
            } else if (assignedAgentId) {
              profitPerUnit = salePrice.minus(costPrice);
            }
            const amount = salePrice.mul(requested.quantity);
            const cost = costPrice.mul(requested.quantity);
            const profit = profitPerUnit.mul(requested.quantity);
            lines.push({
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              quantity: requested.quantity,
              costPrice,
              salePrice,
              profit,
            });
            totalAmount = totalAmount.plus(amount);
            totalCost = totalCost.plus(cost);
            totalProfit = totalProfit.plus(profit);
          }

          const createdOrder = await tx.order.create({
            data: {
              customerId: user.role === UserRole.CUSTOMER ? user.id : undefined,
              agentId: assignedAgentId,
              customerName: input.customerName.trim(),
              customerPhone: input.customerPhone,
              deliveryAddress: input.deliveryAddress.trim(),
              comment: input.comment?.trim() || null,
              totalAmount,
              totalCost,
              totalProfit,
              idempotencyKey: input.idempotencyKey,
              items: { create: lines },
            },
            include: { items: true, statusHistory: true },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: createdOrder.id,
              changedBy: user.id,
              from: OrderStatus.NEW,
              to: OrderStatus.NEW,
            },
          });

          for (const line of lines) {
            await this.inventoryService.reserve(tx, line, createdOrder.id, createdOrder.orderNumber);
          }

          await tx.notificationLog.create({
            data: { orderId: createdOrder.id, event: 'ORDER_CREATED' },
          });
          return createdOrder;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      void this.telegram.dispatchOrder(order.id);
      return this.hideFinancialsFromCustomer(order, user);
    } catch (error) {
      if (this.isUniqueViolation(error) && input.idempotencyKey) {
        const existing = await this.prisma.order.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { items: true },
        });
        if (existing && (existing.customerId === user.id || existing.agentId === user.id)) {
          return this.hideFinancialsFromCustomer(existing, user);
        }
      }
      throw error;
    }
  }

  async list(user: AuthenticatedUser, status?: OrderStatus) {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(user.role === UserRole.ADMIN
          ? {}
          : user.role === UserRole.AGENT
            ? { agentId: user.id }
            : { customerId: user.id }),
        ...(status ? { status } : {}),
      },
      include: { items: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return orders.map((order) => this.hideFinancialsFromCustomer(order, user));
  }

  async get(id: string, user: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (
      user.role !== UserRole.ADMIN &&
      order.customerId !== user.id &&
      order.agentId !== user.id
    ) {
      throw new NotFoundException('Order not found');
    }
    return this.hideFinancialsFromCustomer(order, user);
  }

  async changeStatus(id: string, nextStatus: OrderStatus, actorId: string) {
    const updated = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!order) throw new NotFoundException('Order not found');
        if (!transitions[order.status].includes(nextStatus)) {
          throw new BadRequestException(`Cannot change order status from ${order.status} to ${nextStatus}`);
        }

        const changed = await tx.order.updateMany({
          where: { id, status: order.status },
          data: { status: nextStatus },
        });
        if (changed.count !== 1) throw new ConflictException('Order status has changed; reload and try again');

        await tx.orderStatusHistory.create({
          data: { orderId: id, changedBy: actorId, from: order.status, to: nextStatus },
        });

        if (nextStatus === OrderStatus.CANCELLED) {
          for (const item of order.items) {
            await this.inventoryService.restore(tx, item, order);
          }
        }

        await tx.notificationLog.create({
          data: {
            orderId: id,
            event: nextStatus === OrderStatus.CANCELLED ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED',
          },
        });
        return tx.order.findUniqueOrThrow({
          where: { id },
          include: { items: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    void this.telegram.dispatchOrder(id);
    return updated;
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private hideFinancialsFromCustomer<T extends {
    totalCost: Prisma.Decimal;
    totalProfit: Prisma.Decimal;
    items: Array<{ costPrice: Prisma.Decimal; profit: Prisma.Decimal }>;
  }>(order: T, user: AuthenticatedUser): T | object {
    if (user.role !== UserRole.CUSTOMER) return order;
    const { totalCost: _cost, totalProfit: _profit, ...publicOrder } = order;
    return {
      ...publicOrder,
      items: order.items.map(({ costPrice: _itemCost, profit: _itemProfit, ...item }) => item),
    };
  }
}
