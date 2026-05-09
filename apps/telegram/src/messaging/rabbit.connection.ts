import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqpcm from 'amqp-connection-manager';
import type { AmqpConnectionManager } from 'amqp-connection-manager';

@Injectable()
export class RabbitConnection implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RabbitConnection.name);
  private connection!: AmqpConnectionManager;

  constructor(private readonly config: ConfigService) {}

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

    await new Promise<void>((resolve) => this.connection.once('connect', () => resolve()));
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.connection?.close();
    } catch (err) {
      this.logger.warn(`connection close: ${(err as Error).message}`);
    }
  }

  getConnection(): AmqpConnectionManager {
    if (!this.connection) throw new Error('rabbit connection is not initialised');
    return this.connection;
  }
}
