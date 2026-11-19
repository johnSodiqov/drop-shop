import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationStatus, Prisma } from '@prisma/client';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_ATTEMPTS = 8;
const TELEGRAM_TIMEOUT_MS = 8_000;

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async dispatchOrder(orderId: string): Promise<void> {
    try {
      const pending = await this.prisma.notificationLog.findMany({
        where: { orderId, status: NotificationStatus.PENDING, nextAttemptAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
      });
      for (const notification of pending) await this.deliver(notification.id);
    } catch (error) {
      this.logger.error(`Could not dispatch order notifications for ${orderId}`, error);
    }
  }

  async retry(notificationId: string): Promise<{ success: true }> {
    const notification = await this.prisma.notificationLog.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.status !== NotificationStatus.FAILED) {
      throw new ConflictException('Only a failed notification can be manually retried');
    }
    await this.prisma.notificationLog.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.PENDING, attempts: 0, nextAttemptAt: new Date(), lastError: null },
    });
    await this.deliver(notificationId);
    return { success: true };
  }

  listRecent() {
    return this.prisma.notificationLog.findMany({
      include: { order: { select: { orderNumber: true, customerName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Interval(30_000)
  async retryPending(): Promise<void> {
    const staleBefore = new Date(Date.now() - 2 * 60_000);
    await this.prisma.notificationLog.updateMany({
      where: { status: NotificationStatus.PROCESSING, updatedAt: { lt: staleBefore } },
      data: { status: NotificationStatus.PENDING },
    });
    const pending = await this.prisma.notificationLog.findMany({
      where: { status: NotificationStatus.PENDING, nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { id: true },
    });
    for (const notification of pending) await this.deliver(notification.id);
  }

  private async deliver(notificationId: string): Promise<void> {
    const claimed = await this.prisma.notificationLog.updateMany({
      where: { id: notificationId, status: NotificationStatus.PENDING },
      data: { status: NotificationStatus.PROCESSING, attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) return;

    try {
      const notification = await this.prisma.notificationLog.findUniqueOrThrow({
        where: { id: notificationId },
        include: {
          order: {
            include: {
              agent: { select: { name: true, phone: true } },
              items: true,
              statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
      });
      const message = this.formatMessage(notification);
      await this.send(message);
      await this.prisma.notificationLog.update({
        where: { id: notificationId },
        data: { status: NotificationStatus.SENT, sentAt: new Date(), lastError: null },
      });
    } catch (error) {
      const record = await this.prisma.notificationLog.findUnique({
        where: { id: notificationId },
        select: { attempts: true },
      });
      const attempts = record?.attempts ?? MAX_ATTEMPTS;
      const delaySeconds = Math.min(3600, 15 * 2 ** Math.max(0, attempts - 1));
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown Telegram delivery error';
      await this.prisma.notificationLog.update({
        where: { id: notificationId },
        data: {
          status: attempts >= MAX_ATTEMPTS ? NotificationStatus.FAILED : NotificationStatus.PENDING,
          lastError: message,
          nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
        },
      });
      this.logger.error(`Telegram notification ${notificationId} failed (attempt ${attempts})`);
    }
  }

  private async send(text: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_ADMIN_CHAT_ID');
    if (!token || !chatId) throw new Error('Telegram bot token or admin chat ID is not configured');

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Telegram API returned HTTP ${response.status}`);
    const payload = (await response.json()) as { ok?: boolean; description?: string };
    if (!payload.ok) throw new Error(`Telegram rejected the message: ${payload.description ?? 'unknown error'}`);
  }

  private formatMessage(notification: Prisma.NotificationLogGetPayload<{
    include: {
      order: {
        include: {
          agent: { select: { name: true; phone: true } };
          items: true;
          statusHistory: { orderBy: { createdAt: 'desc' }; take: 1 };
        };
      };
    };
  }>): string {
    const { order } = notification;
    const eventTitle =
      notification.event === 'ORDER_CREATED'
        ? 'НОВЫЙ ЗАКАЗ'
        : notification.event === 'ORDER_CANCELLED'
          ? 'ЗАКАЗ ОТМЕНЁН'
          : 'ИЗМЕНЕНИЕ СТАТУСА ЗАКАЗА';
    const items = order.items
      .map((item) => {
        const cost = item.costPrice.mul(item.quantity).toFixed(2);
        const total = item.salePrice.mul(item.quantity).toFixed(2);
        return `• ${this.escape(item.productName)} × ${item.quantity} — закупка ${cost}, продажа ${total} UZS`;
      })
      .join('\n');
    const date = order.createdAt.toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });
    const agent = order.agent
      ? `\nАгент: ${this.escape(order.agent.name)} (${this.escape(order.agent.phone)})`
      : '';
    const status = order.statusHistory[0]
      ? `\nСтатус: ${this.escape(order.statusHistory[0].to)}`
      : '';
    return [
      `<b>${eventTitle} №${order.orderNumber}</b>`,
      `Дата: ${this.escape(date)}`,
      `Покупатель: ${this.escape(order.customerName)}`,
      `Телефон: ${this.escape(order.customerPhone)}`,
      `Адрес: ${this.escape(order.deliveryAddress)}`,
      `Способ оплаты: ${this.escape({ CASH: 'Наличными', CARD_ON_DELIVERY: 'Картой при получении', TRANSFER_AGENT: 'Переводом / связаться с агентом' }[order.paymentMethod])}`,
      `Товары:\n${items}`,
      `Закупочная стоимость: ${order.totalCost.toFixed(2)} UZS`,
      `Сумма продажи: ${order.totalAmount.toFixed(2)} UZS`,
      `Прибыль агента: ${order.totalProfit.toFixed(2)} UZS`,
      `Комментарий: ${this.escape(order.comment || '—')}`,
    ].concat(agent, status).join('\n');
  }

  private escape(value: string): string {
    return value.replace(/[&<>"]/g, (character) => {
      const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
      return entities[character]!;
    });
  }
}
