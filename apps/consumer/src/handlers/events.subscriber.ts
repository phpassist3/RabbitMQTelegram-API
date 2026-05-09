import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EXCHANGES, QUEUES, ROUTING_KEYS } from '@app/contracts';
import {
  IdempotencyStore,
  RabbitSubscriber,
} from '@app/messaging';
import { RabbitConnection } from '../messaging/rabbit.connection';
import { EventHandler } from './event.handler';
import { IDEMPOTENCY_STORE } from './idempotency.token';

@Injectable()
export class EventsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsSubscriber.name);
  private subscriber!: RabbitSubscriber;

  constructor(
    private readonly connection: RabbitConnection,
    private readonly handler: EventHandler,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.subscriber = new RabbitSubscriber(
      this.connection.getConnection(),
      {
        name: 'processor',
        prefetch: this.config.getOrThrow<number>('rabbit.prefetch'),
        maxAttempts: this.config.getOrThrow<number>('rabbit.maxAttempts'),
        topology: {
          queue: QUEUES.processor,
          retryQueue: QUEUES.processorRetry,
          deadQueue: QUEUES.processorDead,
          retryTtlMs: this.config.getOrThrow<number>('rabbit.retryDelayMs'),
          bindings: [{ exchange: EXCHANGES.events, routingKey: ROUTING_KEYS.any }],
        },
      },
      this.handler,
      this.idempotency,
    );
    await this.subscriber.start();
    this.logger.log('events subscriber started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.stop();
  }
}
