import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationStatus, OrderStatus, Prisma, UserRole } from '@prisma/client';
import { Interval } from '@nestjs/schedule';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { AuthenticatedUser } from '../../common/auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_ATTEMPTS = 8;
const TELEGRAM_TIMEOUT_MS = 8_000;
const LINK_CODE_TTL_MS = 10 * 60_000;

type TelegramOrder = Prisma.OrderGetPayload<{
  include: {
    items: true;
    statusHistory: {
      orderBy: { createdAt: 'asc' };
      include: { user: { select: { id: true; name: true } } };
    };
  };
}>;

const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.NEW]: '\u041d\u043e\u0432\u044b\u0439',
  [OrderStatus.CONFIRMED]: '\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d',
  [OrderStatus.PACKING]: '\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044f',
  [OrderStatus.DELIVERY]: '\u0412 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0435',
  [OrderStatus.DELIVERED]: '\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d',
  [OrderStatus.CANCELLED]: '\u041e\u0442\u043c\u0435\u043d\u0451\u043d',
};

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async issueAdminLinkCode(userId: string): Promise<{ code: string; expiresAt: Date }> {
    const code = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
    const codeHash = this.hashLinkCode(code);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { telegramLinkCodeHash: codeHash, telegramLinkExpiresAt: expiresAt },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: 'TELEGRAM_LINK_CODE_ISSUED',
          target: userId,
          details: { expiresAt: expiresAt.toISOString() },
        },
      }),
    ]);
    return { code, expiresAt };
  }

  async linkAdminAccount(telegramUserId: string, chatId: string, code: string): Promise<{ name: string }> {
    const codeHash = this.hashLinkCode(code);
    const admin = await this.prisma.user.findFirst({
      where: {
        telegramLinkCodeHash: codeHash,
        telegramLinkExpiresAt: { gt: new Date() },
        role: UserRole.ADMIN,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    if (!admin) throw new UnauthorizedException('Link code is invalid or expired');
    const linkedUser = await this.prisma.user.findUnique({ where: { telegramUserId }, select: { id: true } });
    if (linkedUser && linkedUser.id !== admin.id) throw new ConflictException('This Telegram account is already linked to another administrator');

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.updateMany({
          where: { telegramUserId },
          data: { telegramUserId: null, telegramChatId: null },
        });
        const consumed = await tx.user.updateMany({
          where: {
            id: admin.id,
            telegramLinkCodeHash: codeHash,
            telegramLinkExpiresAt: { gt: new Date() },
            role: UserRole.ADMIN,
            isActive: true,
          },
          data: {
            telegramUserId,
            telegramChatId: chatId,
            telegramLinkCodeHash: null,
            telegramLinkExpiresAt: null,
          },
        });
        if (consumed.count !== 1) throw new UnauthorizedException('Link code has already been used');
        await tx.auditLog.create({
          data: {
            userId: admin.id,
            action: 'TELEGRAM_ACCOUNT_LINKED',
            target: admin.id,
            details: { telegramUserId },
          },
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('This Telegram account is already linked');
      throw error;
    }
    this.logger.log(`Telegram account linked to administrator ${admin.id}`);
    return { name: admin.name };
  }

  async unlinkAdminAccount(userId: string): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { telegramUserId: true } });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { telegramUserId: null, telegramChatId: null, telegramLinkCodeHash: null, telegramLinkExpiresAt: null },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: 'TELEGRAM_ACCOUNT_UNLINKED',
          target: userId,
          details: user?.telegramUserId ? { telegramUserId: user.telegramUserId } : {},
        },
      }),
    ]);
    return { success: true };
  }

  async adminLinkStatus(userId: string): Promise<{ linked: boolean; telegramUserId: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramUserId: true },
    });
    if (!user) throw new NotFoundException('Administrator not found');
    return { linked: Boolean(user.telegramUserId), telegramUserId: user.telegramUserId };
  }

  async findLinkedAdmin(telegramUserId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { telegramUserId },
      select: { id: true, name: true, phone: true, role: true, isActive: true },
    });
    if (!user?.isActive || user.role !== UserRole.ADMIN) return null;
    return { id: user.id, name: user.name, phone: user.phone, role: user.role };
  }

  getWebhookSecret(): string {
    const configured = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (configured) return configured;
    const botToken = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    return createHmac('sha256', refreshSecret).update(`dropstore-telegram-webhook:${botToken}`).digest('hex');
  }

  async registerWebhook(url: string): Promise<{ success: true }> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ConflictException('Webhook URL must be a valid HTTPS URL');
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new ConflictException('Webhook URL must use HTTPS and must not contain credentials');
    }
    await this.callTelegram('setWebhook', {
      url: parsed.toString(),
      secret_token: this.getWebhookSecret(),
      allowed_updates: ['message', 'callback_query'],
    });
    this.logger.log('Telegram webhook registered');
    return { success: true };
  }

  async sendMessage(chatId: string, text: string, replyMarkup?: object): Promise<void> {
    await this.callTelegram('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }

  async answerCallback(callbackQueryId: string, text: string, showAlert = false): Promise<void> {
    await this.callTelegram('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }

  async editMessage(chatId: string, messageId: number, text: string, replyMarkup?: object): Promise<void> {
    await this.callTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }

  formatOrderSummary(order: TelegramOrder): string {
    const itemLines = order.items.map((item) => {
      const lineTotal = item.salePrice.mul(item.quantity).toFixed(2);
      return `\u2022 ${this.escape(item.productName)} x ${item.quantity} - ${lineTotal} UZS`;
    });
    const history = order.statusHistory.slice(-5).map((entry) => {
      const changedAt = entry.createdAt.toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });
      const source = entry.source === 'TELEGRAM' ? 'Telegram' : '\u0441\u0430\u0439\u0442';
      return `\u2022 ${this.escape(statusLabels[entry.from])} -> ${this.escape(statusLabels[entry.to])} | ${this.escape(entry.user.name)} | ${this.escape(changedAt)} | ${source}`;
    });
    return [
      `<b>\u0417\u0430\u043a\u0430\u0437 #${order.orderNumber}</b>`,
      `<b>ID:</b> <code>${this.escape(order.id)}</code>`,
      `<b>\u0414\u0430\u0442\u0430:</b> ${this.escape(order.createdAt.toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' }))}`,
      `<b>\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c:</b> ${this.escape(order.customerName)}`,
      `<b>\u0422\u0435\u043b\u0435\u0444\u043e\u043d:</b> ${this.escape(order.customerPhone)}`,
      `<b>\u0410\u0434\u0440\u0435\u0441:</b> ${this.escape(order.deliveryAddress)}`,
      `<b>\u0421\u0442\u0430\u0442\u0443\u0441:</b> ${this.escape(statusLabels[order.status])}`,
      `<b>\u0422\u043e\u0432\u0430\u0440\u044b:</b>\n${itemLines.join('\n') || '-'}`,
      `<b>\u0421\u0443\u043c\u043c\u0430:</b> ${order.totalAmount.toFixed(2)} UZS`,
      ...(order.comment ? [`<b>\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439:</b> ${this.escape(order.comment)}`] : []),
      ...(history.length ? [`<b>\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0441\u0442\u0430\u0442\u0443\u0441\u043e\u0432:</b>\n${history.join('\n')}`] : []),
    ].join('\n');
  }
  statusKeyboard(orderId: string, current: OrderStatus): object {
    const options = Object.values(OrderStatus).filter((status) => status !== current);
    const rows = [] as Array<Array<{ text: string; callback_data: string }>>;
    for (let index = 0; index < options.length; index += 2) {
      rows.push(options.slice(index, index + 2).map((status) => ({
        text: statusLabels[status],
        callback_data: `status:${orderId}:${status}`,
      })));
    }
    return { inline_keyboard: rows };
  }

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
              items: true,
              statusHistory: {
                orderBy: { createdAt: 'asc' },
                include: { user: { select: { id: true, name: true } } },
              },
            },
          },
        },
      });
      await this.sendMessage(
        this.config.getOrThrow<string>('TELEGRAM_ADMIN_CHAT_ID'),
        this.formatOrderSummary(notification.order),
        this.statusKeyboard(notification.order.id, notification.order.status),
      );
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

  private async callTelegram(method: string, body: object): Promise<unknown> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('Telegram bot token is not configured');

    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    const payload = (await response.json()) as { ok?: boolean; description?: string; result?: unknown };
    if (!response.ok) throw new Error(`Telegram API returned HTTP ${response.status}`);
    if (!payload.ok) throw new Error(`Telegram rejected the request: ${payload.description ?? 'unknown error'}`);
    return payload.result;
  }

  private hashLinkCode(code: string): string {
    return createHash('sha256').update(code.trim()).digest('hex');
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private escape(value: string): string {
    return value.replace(/[&<>"]/g, (character) => {
      const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
      return entities[character]!;
    });
  }
}
