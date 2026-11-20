import { ConflictException, Injectable } from '@nestjs/common';
import { OrderItem, Order, Prisma, ProductStatus } from '@prisma/client';

@Injectable()
export class InventoryService {
  async reserve(
    tx: Prisma.TransactionClient,
    item: Pick<OrderItem, 'productId' | 'quantity' | 'productName'>,
    orderId: string,
    orderNumber: number,
  ): Promise<void> {
    const changed = await tx.inventory.updateMany({
      where: { productId: item.productId, quantity: { gte: item.quantity } },
      data: { quantity: { decrement: item.quantity } },
    });
    if (changed.count !== 1) {
      throw new ConflictException(`Insufficient stock for ${item.productName}`);
    }
    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        orderId,
        quantity: -item.quantity,
        reason: `Reserved for order ${orderNumber}`,
      },
    });
    const remaining = await tx.inventory.findUniqueOrThrow({
      where: { productId: item.productId },
    });
    if (remaining.quantity === 0) {
      await tx.product.updateMany({
        where: { id: item.productId, status: ProductStatus.ACTIVE },
        data: { status: ProductStatus.OUT_OF_STOCK },
      });
    } else {
      await tx.product.updateMany({
        where: { id: item.productId, status: ProductStatus.OUT_OF_STOCK },
        data: { status: ProductStatus.ACTIVE },
      });
    }
  }

  async restore(
    tx: Prisma.TransactionClient,
    item: Pick<OrderItem, 'productId' | 'quantity'>,
    order: Pick<Order, 'id' | 'orderNumber'>,
  ): Promise<void> {
    await tx.inventory.update({
      where: { productId: item.productId },
      data: { quantity: { increment: item.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        orderId: order.id,
        quantity: item.quantity,
        reason: `Stock restored for cancelled order ${order.orderNumber}`,
      },
    });
    await tx.product.updateMany({
      where: { id: item.productId, status: ProductStatus.OUT_OF_STOCK },
      data: { status: ProductStatus.ACTIVE },
    });
  }
}
