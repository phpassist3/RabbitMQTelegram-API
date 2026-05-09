import { Logger } from '@nestjs/common';
import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { EventEnvelope, isEventEnvelope } from '@app/contracts';
import { assertConsumerTopology, ConsumerTopology } from './topology';
import { IdempotencyStore } from './idempotency.store';

export interface SubscriberOptions {
  name: string;
  prefetch: number;
  maxAttempts: number;
  topology: ConsumerTopology;
}

export interface MessageHandler {
  /** Throw to trigger retry. Return normally to ack. */
  handle(envelope: EventEnvelope<unknown>, raw: ConsumeMessage): Promise<void>;
}

interface XDeathEntry {
  count: number;
  reason: 'rejected' | 'expired' | 'maxlen' | 'delivery-limit';
  queue: string;
}

const X_DEATH = 'x-death';

export class RabbitSubscriber {
  private readonly logger: Logger;
  private channel!: ChannelWrapper;

  constructor(
    private readonly connection: AmqpConnectionManager,
    private readonly options: SubscriberOptions,
    private readonly handler: MessageHandler,
    private readonly idempotency: IdempotencyStore,
  ) {
    this.logger = new Logger(`Subscriber:${options.name}`);
  }

  async start(): Promise<void> {
    const { topology, prefetch } = this.options;

    this.channel = this.connection.createChannel({
      name: `subscriber.${topology.queue}`,
      json: false,
      confirm: true,
      setup: async (ch: ConfirmChannel) => {
        await assertConsumerTopology(ch, topology);
        await ch.prefetch(prefetch);
        await ch.consume(topology.queue, (msg) => this.dispatch(ch, msg), { noAck: false });
      },
    });

    await this.channel.waitForConnect();
    this.logger.log(`listening on ${topology.queue} (prefetch=${prefetch})`);
  }

  async stop(): Promise<void> {
    try {
      await this.channel?.close();
    } catch (err) {
      this.logger.warn(`channel close: ${(err as Error).message}`);
    }
  }

  private async dispatch(ch: ConfirmChannel, msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    const envelope = this.parse(msg);
    if (!envelope) {
      this.logger.error('rejected unparseable message → dead queue');
      await this.sendToDead(ch, msg, 'malformed-payload');
      ch.ack(msg);
      return;
    }

    if (this.idempotency.has(envelope.id)) {
      this.logger.warn(`duplicate id=${envelope.id} type=${envelope.type} — skipped`);
      ch.ack(msg);
      return;
    }

    const attemptsSoFar = this.getRejectedCount(msg);

    try {
      await this.handler.handle(envelope, msg);
      this.idempotency.remember(envelope.id);
      ch.ack(msg);
      this.logger.log(
        `ok id=${envelope.id} type=${envelope.type}` +
          (attemptsSoFar ? ` after ${attemptsSoFar} retries` : ''),
      );
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      const nextAttempt = attemptsSoFar + 1;

      if (nextAttempt >= this.options.maxAttempts) {
        this.logger.error(
          `failed id=${envelope.id} attempts=${nextAttempt}/${this.options.maxAttempts} — dead queue (${message})`,
        );
        await this.sendToDead(ch, msg, message);
        ch.ack(msg);
        return;
      }

      this.logger.warn(
        `failed id=${envelope.id} attempts=${nextAttempt}/${this.options.maxAttempts} — retry (${message})`,
      );
      // requeue=false so the DLX/TTL pipeline takes over
      ch.nack(msg, false, false);
    }
  }

  private parse(msg: ConsumeMessage): EventEnvelope<unknown> | null {
    try {
      const text = msg.content.toString('utf-8');
      const parsed = JSON.parse(text);
      return isEventEnvelope(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private getRejectedCount(msg: ConsumeMessage): number {
    const headers = msg.properties.headers as Record<string, unknown> | undefined;
    const xDeath = headers?.[X_DEATH];
    if (!Array.isArray(xDeath)) return 0;
    const entry = (xDeath as XDeathEntry[]).find(
      (e) => e.queue === this.options.topology.queue && e.reason === 'rejected',
    );
    return entry?.count ?? 0;
  }

  private async sendToDead(
    ch: ConfirmChannel,
    original: ConsumeMessage,
    failReason: string,
  ): Promise<void> {
    const headers = {
      ...(original.properties.headers ?? {}),
      'x-failed-at': new Date().toISOString(),
      'x-fail-reason': failReason.slice(0, 256),
    };
    ch.sendToQueue(this.options.topology.deadQueue, original.content, {
      ...original.properties,
      headers,
      persistent: true,
    });
  }
}
