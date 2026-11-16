import { BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { OrderStatus, Prisma, ProductStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PricingService } from '../pricing/pricing.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

const actor: AuthenticatedUser = {
  id: 'agent-1',
  role: UserRole.AGENT,
  phone: '+998901234567',
  name: 'Agent',
};

function transactionMock(value: object): Prisma.TransactionClient {
  return value as Prisma.TransactionClient;
}

describe('OrdersService critical stock rules', () => {
  it('snapshots the server price and atomically reserves stock when creating an agent order', async () => {
    const tx = transactionMock({
      product: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'product-1',
          sku: 'SKU-1',
          name: 'Product',
          status: ProductStatus.ACTIVE,
          costPrice: new Prisma.Decimal('50000'),
          recommendedPrice: new Prisma.Decimal('70000'),
          minimumPrice: new Prisma.Decimal('60000'),
          maximumMarkup: new Prisma.Decimal('30000'),
          allowAgentPriceChange: true,
          inventory: { quantity: 3 },
        }]),
        update: jest.fn(),
      },
      order: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'order-1',
          orderNumber: 1024,
          customerId: null,
          agentId: actor.id,
          totalAmount: data.totalAmount,
          totalCost: data.totalCost,
          totalProfit: data.totalProfit,
          items: data.items.create,
        })),
        findUnique: jest.fn(),
      },
      orderStatusHistory: { create: jest.fn() },
      notificationLog: { create: jest.fn() },
      inventory: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ quantity: 2 }),
      },
      inventoryMovement: { create: jest.fn() },
      agentProfile: { findUnique: jest.fn() },
    });
    const prisma = {
      $transaction: jest.fn(async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const telegram = { dispatchOrder: jest.fn().mockResolvedValue(undefined) } as unknown as TelegramService;
    const service = new OrdersService(prisma, telegram, new InventoryService(), new PricingService());
    const input: CreateOrderDto = {
      items: [{ productId: 'product-1', quantity: 1, salePrice: '75000' }],
      customerName: 'Customer',
      customerPhone: '+998901234568',
      deliveryAddress: 'Tashkent, Main street 1',
    };

    await service.create(input, actor);

    const created = (tx.order.create as jest.Mock).mock.calls[0][0].data;
    expect(created.totalAmount.toFixed(2)).toBe('75000.00');
    expect(created.totalCost.toFixed(2)).toBe('50000.00');
    expect(created.totalProfit.toFixed(2)).toBe('25000.00');
    expect(created.items.create[0].costPrice.toFixed(2)).toBe('50000.00');
    expect(created.items.create[0].salePrice.toFixed(2)).toBe('75000.00');
    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: { productId: 'product-1', quantity: { gte: 1 } },
      data: { quantity: { decrement: 1 } },
    });
    expect(telegram.dispatchOrder).toHaveBeenCalledWith('order-1');
  });

  it('keeps customer orders at the recommended price and hides internal cost and profit', async () => {
    const tx = transactionMock({
      product: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'product-1',
          sku: 'SKU-1',
          name: 'Product',
          status: ProductStatus.ACTIVE,
          costPrice: new Prisma.Decimal('50000'),
          recommendedPrice: new Prisma.Decimal('70000'),
          minimumPrice: new Prisma.Decimal('60000'),
          maximumMarkup: new Prisma.Decimal('30000'),
          allowAgentPriceChange: true,
          inventory: { quantity: 2 },
        }]),
        update: jest.fn(),
      },
      order: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'order-customer',
          orderNumber: 1026,
          customerId: 'customer-1',
          agentId: undefined,
          totalAmount: data.totalAmount,
          totalCost: data.totalCost,
          totalProfit: data.totalProfit,
          items: data.items.create,
        })),
        findUnique: jest.fn(),
      },
      orderStatusHistory: { create: jest.fn() },
      notificationLog: { create: jest.fn() },
      inventory: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ quantity: 1 }),
      },
      inventoryMovement: { create: jest.fn() },
      agentProfile: { findUnique: jest.fn() },
    });
    const prisma = {
      $transaction: jest.fn(async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const telegram = { dispatchOrder: jest.fn().mockResolvedValue(undefined) } as unknown as TelegramService;
    const service = new OrdersService(prisma, telegram, new InventoryService(), new PricingService());
    const customer: AuthenticatedUser = { ...actor, id: 'customer-1', role: UserRole.CUSTOMER };
    const input: CreateOrderDto = {
      items: [{ productId: 'product-1', quantity: 1 }],
      customerName: 'Customer',
      customerPhone: '+998901234568',
      deliveryAddress: 'Tashkent, Main street 1',
    };

    const result = await service.create(input, customer) as Record<string, unknown> & {
      items: Array<Record<string, unknown>>;
    };
    const stored = (tx.order.create as jest.Mock).mock.calls[0][0].data;

    expect(stored.totalAmount.toFixed(2)).toBe('70000.00');
    expect(stored.totalCost.toFixed(2)).toBe('50000.00');
    expect(stored.totalProfit.toFixed(2)).toBe('0.00');
    expect(result.totalCost).toBeUndefined();
    expect(result.totalProfit).toBeUndefined();
    expect(result.items[0].costPrice).toBeUndefined();
    expect(result.items[0].profit).toBeUndefined();
  });

  it('rejects customer-supplied sale prices before opening a database transaction', async () => {
    const prisma = { $transaction: jest.fn() } as unknown as PrismaService;
    const telegram = { dispatchOrder: jest.fn() } as unknown as TelegramService;
    const service = new OrdersService(prisma, telegram, new InventoryService(), new PricingService());
    const customer: AuthenticatedUser = { ...actor, id: 'customer-1', role: UserRole.CUSTOMER };
    const input: CreateOrderDto = {
      items: [{ productId: 'product-1', quantity: 1, salePrice: '1' }],
      customerName: 'Customer',
      customerPhone: '+998901234568',
      deliveryAddress: 'Tashkent, Main street 1',
    };

    await expect(service.create(input, customer)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('restores cancelled stock once and rejects a repeated cancellation', async () => {
    let status = OrderStatus.NEW;
    const order = {
      id: 'order-2',
      orderNumber: 1025,
      status,
      items: [{ productId: 'product-1', quantity: 2, productName: 'Product' }],
    };
    const tx = transactionMock({
      order: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...order, status })),
        updateMany: jest.fn().mockImplementation(({ data }) => {
          status = data.status;
          return Promise.resolve({ count: 1 });
        }),
        findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve({ ...order, status, statusHistory: [] })),
      },
      orderStatusHistory: { create: jest.fn() },
      notificationLog: { create: jest.fn() },
      inventory: { update: jest.fn().mockResolvedValue({ quantity: 7 }) },
      inventoryMovement: { create: jest.fn() },
      product: { updateMany: jest.fn() },
    });
    const prisma = {
      $transaction: jest.fn(async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const telegram = { dispatchOrder: jest.fn().mockResolvedValue(undefined) } as unknown as TelegramService;
    const service = new OrdersService(prisma, telegram, new InventoryService(), new PricingService());
    const admin: AuthenticatedUser = { ...actor, id: 'admin-1', role: UserRole.ADMIN };

    await service.changeStatus(order.id, OrderStatus.CANCELLED, admin.id);
    await expect(service.changeStatus(order.id, OrderStatus.CANCELLED, admin.id)).rejects.toThrow(BadRequestException);

    expect(tx.inventory.update).toHaveBeenCalledTimes(1);
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(1);
    expect(telegram.dispatchOrder).toHaveBeenCalledTimes(1);
  });
});
