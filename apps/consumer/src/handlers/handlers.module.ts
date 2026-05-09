import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InMemoryIdempotencyStore } from '@app/messaging';
import { MessagingModule } from '../messaging/messaging.module';
import { EventHandler } from './event.handler';
import { EventsSubscriber } from './events.subscriber';
import { IDEMPOTENCY_STORE } from './idempotency.token';

@Module({
  imports: [MessagingModule],
  providers: [
    EventHandler,
    {
      provide: IDEMPOTENCY_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new InMemoryIdempotencyStore(config.getOrThrow<number>('idempotency.cacheSize')),
    },
    EventsSubscriber,
  ],
})
export class HandlersModule {}
