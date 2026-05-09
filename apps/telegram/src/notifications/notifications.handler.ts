import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConsumeMessage } from 'amqplib';
import type { EventEnvelope, NotificationPayload } from '@app/contracts';
import type { MessageHandler } from '@app/messaging';
import { TelegramClient } from '../telegram/telegram.client';
import { formatNotification } from './message-formatter';

@Injectable()
export class NotificationsHandler implements MessageHandler {
  private readonly logger = new Logger(NotificationsHandler.name);
  private readonly defaultChatId?: string;

  constructor(
    private readonly telegram: TelegramClient,
    config: ConfigService,
  ) {
    this.defaultChatId = config.get<string>('telegram.defaultChatId') || undefined;
  }

  async handle(envelope: EventEnvelope<unknown>, _raw: ConsumeMessage): Promise<void> {
    const payload = envelope.payload as Partial<NotificationPayload> | undefined;

    if (!payload || payload.channel !== 'telegram' || typeof payload.message !== 'string') {
      // Not addressed to this dispatcher, or shape we cannot handle.
      // Drop without retry — the broker would just send it back forever.
      this.logger.debug(`skipped id=${envelope.id} type=${envelope.type} (not a telegram payload)`);
      return;
    }

    const chatId = (payload.recipient && payload.recipient.trim()) || this.defaultChatId;
    if (!chatId) {
      throw new Error('no recipient and no TELEGRAM_DEFAULT_CHAT_ID configured');
    }

    const text = formatNotification(payload as NotificationPayload);
    await this.telegram.sendMessage(chatId, text);

    this.logger.log(`sent id=${envelope.id} chat=${chatId} bytes=${text.length}`);
  }
}
