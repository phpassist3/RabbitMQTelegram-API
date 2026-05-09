import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EXCHANGES, EventEnvelope, HEADERS } from '@app/contracts';
import { RabbitConnection } from './rabbit.connection';

export interface PublishOptions {
  routingKey: string;
  /** propagated as `correlationId`; defaults to envelope.id */
  correlationId?: string;
}

@Injectable()
export class PublisherService {
  private readonly logger = new Logger(PublisherService.name);
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly rabbit: RabbitConnection,
    config: ConfigService,
  ) {
    this.retries = config.getOrThrow<number>('rabbit.publishRetries');
    this.backoffMs = config.getOrThrow<number>('rabbit.publishBackoffMs');
    this.timeoutMs = config.getOrThrow<number>('rabbit.publishTimeoutMs');
  }

  async publish<T>(envelope: EventEnvelope<T>, opts: PublishOptions): Promise<void> {
    const channel = this.rabbit.getChannel();
    const headers = {
      [HEADERS.eventId]: envelope.id,
      [HEADERS.eventType]: envelope.type,
      [HEADERS.occurredAt]: envelope.occurredAt,
    };

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.retries) {
      try {
        // ChannelWrapper.publish on a confirm channel resolves once broker has acked the message.
        await this.withTimeout(
          channel.publish(EXCHANGES.events, opts.routingKey, envelope, {
            messageId: envelope.id,
            correlationId: opts.correlationId ?? envelope.id,
            contentType: 'application/json',
            contentEncoding: 'utf-8',
            persistent: true,
            timestamp: Date.now(),
            headers,
          }),
          this.timeoutMs,
        );

        if (attempt === 0) {
          this.logger.debug(`published id=${envelope.id} type=${envelope.type}`);
        } else {
          this.logger.log(
            `published id=${envelope.id} after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`,
          );
        }
        return;
      } catch (err) {
        lastError = err;
        attempt += 1;
        if (attempt > this.retries) break;

        const delay = this.backoffMs * Math.pow(2, attempt - 1);
        this.logger.warn(
          `publish failed id=${envelope.id} attempt=${attempt}/${this.retries} (${
            (err as Error).message
          }) — retry in ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }

    this.logger.error(
      `publish gave up id=${envelope.id} after ${this.retries} retries: ${
        (lastError as Error)?.message ?? 'unknown'
      }`,
    );
    throw new ServiceUnavailableException('broker is not accepting messages');
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`publish timed out after ${ms}ms`)), ms);
    });
    return Promise.race([p, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
