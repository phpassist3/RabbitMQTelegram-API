import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqpcm from 'amqp-connection-manager';
import type { ChannelWrapper, AmqpConnectionManager } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import { EXCHANGES } from '@app/contracts';

/**
 * Owns the broker connection and a dedicated confirm channel for publishing.
 * amqp-connection-manager handles reconnects and queues messages until the link is back.
 */
@Injectable()
export class RabbitConnection implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RabbitConnection.name);
  private connection!: AmqpConnectionManager;
  private channel!: ChannelWrapper;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async onApplicationBootstrap(): Promise<void> {
    const uri = this.config.getOrThrow<string>('rabbit.uri');

    this.connection = amqpcm.connect([uri], {
      heartbeatIntervalInSeconds: 15,
      reconnectTimeInSeconds: 5,
    });

    this.connection.on('connect', () => this.logger.log('amqp connected'));
    this.connection.on('disconnect', ({ err }) =>
      this.logger.warn(`amqp disconnected: ${err?.message ?? 'unknown'}`),
    );
    this.connection.on('connectFailed', ({ err }) =>
      this.logger.error(`amqp connect failed: ${err?.message ?? 'unknown'}`),
    );

    this.channel = this.connection.createChannel({
      name: 'producer.publish',
      json: true,
      confirm: true,
      setup: async (ch: ConfirmChannel) => {
        await ch.assertExchange(EXCHANGES.events, 'topic', { durable: true });
      },
    });

    // Wait for the channel to be ready so the first publish does not get queued indefinitely.
    await this.channel.waitForConnect();
    this.logger.log('publisher channel ready');
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.channel?.close();
    } catch (err) {
      this.logger.warn(`channel close: ${(err as Error).message}`);
    }
    try {
      await this.connection?.close();
    } catch (err) {
      this.logger.warn(`connection close: ${(err as Error).message}`);
    }
  }

  getChannel(): ChannelWrapper {
    if (!this.channel) throw new Error('publisher channel is not initialised');
    return this.channel;
  }
}
