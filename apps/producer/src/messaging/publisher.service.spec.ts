import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublisherService } from './publisher.service';
import { RabbitConnection } from './rabbit.connection';

function buildConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'rabbit.publishRetries': 3,
    'rabbit.publishBackoffMs': 1, // keep tests fast
    'rabbit.publishTimeoutMs': 1000,
    ...overrides,
  };
  return {
    getOrThrow: (key: string) => {
      if (!(key in values)) throw new Error(`unknown key ${key}`);
      return values[key];
    },
  } as unknown as ConfigService;
}

function buildRabbit(publishImpl: jest.Mock): RabbitConnection {
  return {
    getChannel: () => ({ publish: publishImpl }),
  } as unknown as RabbitConnection;
}

const envelope = {
  id: 'evt-1',
  type: 'notification.created',
  occurredAt: '2026-05-09T00:00:00.000Z',
  source: 'producer',
  payload: { channel: 'telegram' as const, recipient: '1', message: 'hi' },
};

describe('PublisherService', () => {
  it('publishes once when broker accepts on the first try', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const svc = new PublisherService(buildRabbit(publish), buildConfig());

    await svc.publish(envelope, { routingKey: 'event.notification' });
    expect(publish).toHaveBeenCalledTimes(1);

    const [exchange, routingKey, payload, opts] = publish.mock.calls[0];
    expect(exchange).toBe('events.x');
    expect(routingKey).toBe('event.notification');
    expect(payload).toEqual(envelope);
    expect(opts.persistent).toBe(true);
    expect(opts.messageId).toBe('evt-1');
    expect(opts.correlationId).toBe('evt-1');
    expect(opts.contentType).toBe('application/json');
    expect(opts.headers['x-event-id']).toBe('evt-1');
  });

  it('retries on transient failure and succeeds within the budget', async () => {
    const publish = jest
      .fn()
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce(undefined);
    const svc = new PublisherService(buildRabbit(publish), buildConfig({ 'rabbit.publishRetries': 5 }));

    await svc.publish(envelope, { routingKey: 'event.notification' });
    expect(publish).toHaveBeenCalledTimes(3);
  });

  it('gives up with ServiceUnavailable when retries are exhausted', async () => {
    const publish = jest.fn().mockRejectedValue(new Error('broker down'));
    const svc = new PublisherService(buildRabbit(publish), buildConfig({ 'rabbit.publishRetries': 2 }));

    await expect(svc.publish(envelope, { routingKey: 'event.notification' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(publish).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});
