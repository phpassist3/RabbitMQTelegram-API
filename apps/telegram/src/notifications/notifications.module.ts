import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InMemoryIdempotencyStore } from '@app/messaging';
import { MessagingModule } from '../messaging/messaging.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsHandler } from './notifications.handler';
import { NotificationsSubscriber } from './notifications.subscriber';
import { IDEMPOTENCY_STORE } from './idempotency.token';

@Module({
  imports: [MessagingModule, TelegramModule],
  providers: [
    NotificationsHandler,
    {
      provide: IDEMPOTENCY_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new InMemoryIdempotencyStore(config.getOrThrow<number>('idempotency.cacheSize')),
    },
    NotificationsSubscriber,
  ],
})
export class NotificationsModule {}
