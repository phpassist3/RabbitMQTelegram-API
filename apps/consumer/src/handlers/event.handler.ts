import { Injectable, Logger } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { EventEnvelope } from '@app/contracts';
import { MessageHandler } from '@app/messaging';

/**
 * Generic processor: parses, logs, and applies any side-effects we care about.
 *
 * For this service the only "side-effect" is structured logging — downstream
 * domains (telegram, analytics, etc.) live in their own consumer services so
 * a single failure does not block the rest.
 */
@Injectable()
export class EventHandler implements MessageHandler {
  private readonly logger = new Logger(EventHandler.name);

  async handle(envelope: EventEnvelope<unknown>, _raw: ConsumeMessage): Promise<void> {
    this.logger.log(
      `event id=${envelope.id} type=${envelope.type} source=${envelope.source} occurredAt=${envelope.occurredAt}`,
    );
    // Domain processing would go here. We keep it intentionally light;
    // the demo proves the consumer wiring works.
  }
}
