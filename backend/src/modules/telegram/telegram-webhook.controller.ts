import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { OrderStatus, OrderStatusSource } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { OrdersService } from '../orders/orders.service';
import { TelegramService } from './telegram.service';

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramUser {
  id: number;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly telegram: TelegramService,
    @Inject(forwardRef(() => OrdersService)) private readonly orders: OrdersService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') receivedSecret?: string,
  ): Promise<{ ok: true }> {
    if (!this.secretMatches(receivedSecret)) throw new UnauthorizedException('Invalid Telegram webhook secret');

    try {
      if (update.callback_query) await this.handleCallback(update.callback_query);
      else if (update.message) await this.handleMessage(update.message);
    } catch (error) {
      this.logger.error('Telegram update processing failed', error);
    }
    return { ok: true };
  }

  private secretMatches(received: string | undefined): boolean {
    if (!received) return false;
    const expected = Buffer.from(this.telegram.getWebhookSecret());
    const actual = Buffer.from(received);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private async handleMessage(message: TelegramMessage): Promise<void> {
    if (!message.from || !message.text || message.chat.type !== 'private') return;
    const [rawCommand, ...args] = message.text.trim().split(/\s+/);
    const command = rawCommand?.split('@')[0]?.toLowerCase();
    const telegramUserId = String(message.from.id);
    const chatId = String(message.chat.id);

    if (command === '/start' || command === '/link') {
      const code = args[0];
      if (!code) {
        await this.telegram.sendMessage(chatId, '\u041f\u0440\u0438\u0432\u044f\u0436\u0438\u0442\u0435 Telegram \u043a \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0443 \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430: \u0432 \u0430\u0434\u043c\u0438\u043d\u043a\u0435 \u0441\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u043a\u043e\u0434 \u043f\u0440\u0438\u0432\u044f\u0437\u043a\u0438, \u0437\u0430\u0442\u0435\u043c \u043e\u0442\u043f\u0440\u0430\u0432\u044c\u0442\u0435 /start <\u043a\u043e\u0434>.');
        return;
      }
      const admin = await this.telegram.linkAdminAccount(telegramUserId, chatId, code);
      await this.telegram.sendMessage(chatId, `\u0410\u043a\u043a\u0430\u0443\u043d\u0442 ${this.escape(admin.name)} \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d. \u0414\u043e\u0441\u0442\u0443\u043f \u043a \u0431\u043e\u0442\u0443 \u0435\u0441\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0443 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u043e\u0432.\n/orders - \u0437\u0430\u043a\u0430\u0437\u044b\n/order <\u043d\u043e\u043c\u0435\u0440> - \u043f\u043e\u0438\u0441\u043a \u0437\u0430\u043a\u0430\u0437\u0430`);
      return;
    }

    const admin = await this.telegram.findLinkedAdmin(telegramUserId);
    if (!admin) {
      await this.telegram.sendMessage(chatId, '\u0414\u043e\u0441\u0442\u0443\u043f \u0437\u0430\u043a\u0440\u044b\u0442. \u0421\u0432\u044f\u0436\u0438\u0442\u0435 Telegram \u0441 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u043c \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u043e\u043c ADMIN \u043d\u0430 \u0441\u0430\u0439\u0442\u0435.');
      return;
    }

    if (command === '/help') {
      await this.telegram.sendMessage(chatId, '/orders - \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 10 \u0437\u0430\u043a\u0430\u0437\u043e\u0432\n/order <\u043d\u043e\u043c\u0435\u0440> - \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0437\u0430\u043a\u0430\u0437\n\u0421\u0442\u0430\u0442\u0443\u0441 \u043c\u0435\u043d\u044f\u0435\u0442\u0441\u044f \u043a\u043d\u043e\u043f\u043a\u0430\u043c\u0438 \u0432 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0435 \u0437\u0430\u043a\u0430\u0437\u0430.');
      return;
    }
    if (command === '/orders') {
      const orders = await this.orders.list(admin);
      const recent = orders.slice(0, 10);
      if (!recent.length) {
        await this.telegram.sendMessage(chatId, '\u0417\u0430\u043a\u0430\u0437\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.');
        return;
      }
      for (const order of recent) {
        await this.telegram.sendMessage(
          chatId,
          this.telegram.formatOrderSummary(order),
          this.telegram.statusKeyboard(order.id, order.status),
        );
      }
      return;
    }
    if (command === '/order') {
      const orderNumber = Number(args[0]);
      if (!Number.isSafeInteger(orderNumber) || orderNumber < 1) {
        await this.telegram.sendMessage(chatId, '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440: /order 1024');
        return;
      }
      const order = await this.orders.getByOrderNumber(orderNumber, admin);
      await this.telegram.sendMessage(
        chatId,
        this.telegram.formatOrderSummary(order),
        this.telegram.statusKeyboard(order.id, order.status),
      );
    }
  }

  private async handleCallback(callback: TelegramCallbackQuery): Promise<void> {
    const admin = await this.telegram.findLinkedAdmin(String(callback.from.id));
    if (!admin) {
      await this.telegram.answerCallback(callback.id, '\u041d\u0443\u0436\u0435\u043d \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0439 \u0430\u043a\u043a\u0430\u0443\u043d\u0442 ADMIN.', true);
      return;
    }
    const match = callback.data?.match(/^status:([a-zA-Z0-9_-]+):(NEW|CONFIRMED|PACKING|DELIVERY|DELIVERED|CANCELLED)$/);
    if (!match || !callback.message) {
      await this.telegram.answerCallback(callback.id, '\u041d\u0435\u0432\u0435\u0440\u043d\u043e\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435.', true);
      return;
    }

    const [, orderId, requestedStatus] = match;
    try {
      const order = await this.orders.changeStatus(
        orderId,
        requestedStatus as OrderStatus,
        admin.id,
        OrderStatusSource.TELEGRAM,
      );
      await this.telegram.answerCallback(callback.id, `\u0417\u0430\u043a\u0430\u0437 \u2116${order.orderNumber} \u043e\u0431\u043d\u043e\u0432\u043b\u0451\u043d.`);
      await this.telegram.editMessage(
        String(callback.message.chat.id),
        callback.message.message_id,
        this.telegram.formatOrderSummary(order),
        this.telegram.statusKeyboard(order.id, order.status),
      );
    } catch (error) {
      this.logger.warn(`Telegram status change rejected for order ${orderId}: ${error instanceof Error ? error.message : 'unknown error'}`);
      const message = error instanceof BadRequestException
        ? '\u042d\u0442\u043e\u0442 \u0441\u0442\u0430\u0442\u0443\u0441 \u0443\u0436\u0435 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d.'
        : error instanceof Error && error.message.includes('Insufficient stock')
          ? '\u041d\u0435\u0445\u0432\u0430\u0442\u0430\u0435\u0442 \u0442\u043e\u0432\u0430\u0440\u0430 \u043d\u0430 \u0441\u043a\u043b\u0430\u0434\u0435 \u0434\u043b\u044f \u0432\u043e\u0437\u0432\u0440\u0430\u0442\u0430 \u0437\u0430\u043a\u0430\u0437\u0430 \u0432 \u0440\u0430\u0431\u043e\u0442\u0443.'
          : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441. \u041e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443 \u0437\u0430\u043a\u0430\u0437\u0430.';
      await this.telegram.answerCallback(callback.id, message, true);
    }
  }

  private escape(value: string): string {
    return value.replace(/[&<>\"]/g, (character) => {
      const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
      return entities[character]!;
    });
  }
}
