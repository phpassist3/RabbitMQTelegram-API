import { RabbitSubscriber, MessageHandler } from './rabbit.subscriber';
import { IdempotencyStore } from './idempotency.store';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';

const TOPOLOGY = {
  queue: 'q.main',
  retryQueue: 'q.main.retry',
  deadQueue: 'q.main.dead',
  retryTtlMs: 1000,
  bindings: [{ exchange: 'events.x', routingKey: 'event.#' }],
};

function makeMsg(opts: {
  body: unknown;
  headers?: Record<string, unknown>;
  raw?: boolean;
}): ConsumeMessage {
  const content = opts.raw
    ? Buffer.from(String(opts.body))
    : Buffer.from(JSON.stringify(opts.body));
  return {
    content,
    fields: { deliveryTag: 1, redelivered: false, exchange: 'events.x', routingKey: 'event.x' },
    properties: { headers: opts.headers ?? {} },
  } as unknown as ConsumeMessage;
}

function makeChannel() {
  return {
    ack: jest.fn(),
    nack: jest.fn(),
    sendToQueue: jest.fn(),
  } as unknown as ConfirmChannel & { ack: jest.Mock; nack: jest.Mock; sendToQueue: jest.Mock };
}

function makeStore(): IdempotencyStore & { remembered: string[] } {
  const seen = new Set<string>();
  const remembered: string[] = [];
  return {
    has: (id: string) => seen.has(id),
    remember: (id: string) => {
      seen.add(id);
      remembered.push(id);
    },
    remembered,
  };
}

function buildSubscriber(handler: MessageHandler, idem = makeStore(), maxAttempts = 3) {
  // connection is not exercised by dispatch — pass a stub
  const sub = new RabbitSubscriber(
    {} as never,
    { name: 'test', prefetch: 1, maxAttempts, topology: TOPOLOGY },
    handler,
    idem,
  );
  return { sub, idem };
}

const validEnvelope = {
  id: 'evt-1',
  type: 'notification.created',
  occurredAt: '2026-05-09T00:00:00.000Z',
  source: 'producer',
  payload: { channel: 'telegram', recipient: '1', message: 'hi' },
};

describe('RabbitSubscriber.dispatch', () => {
  it('acks and remembers id on successful processing', async () => {
    const handler: MessageHandler = { handle: jest.fn().mockResolvedValue(undefined) };
    const { sub, idem } = buildSubscriber(handler);
    const ch = makeChannel();
    const msg = makeMsg({ body: validEnvelope });

    await (sub as unknown as { dispatch(c: ConfirmChannel, m: ConsumeMessage): Promise<void> }).dispatch(ch, msg);

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(ch.ack).toHaveBeenCalledTimes(1);
    expect(ch.nack).not.toHaveBeenCalled();
    expect(ch.sendToQueue).not.toHaveBeenCalled();
    expect((idem as { remembered: string[] }).remembered).toEqual(['evt-1']);
  });

  it('nacks (no requeue) on transient handler failure with retries remaining', async () => {
    const handler: MessageHandler = {
      handle: jest.fn().mockRejectedValue(new Error('upstream timeout')),
    };
    const { sub } = buildSubscriber(handler, makeStore(), 3);
    const ch = makeChannel();
    const msg = makeMsg({ body: validEnvelope });

    await (sub as unknown as { dispatch(c: ConfirmChannel, m: ConsumeMessage): Promise<void> }).dispatch(ch, msg);

    expect(ch.nack).toHaveBeenCalledWith(msg, false, false);
    expect(ch.ack).not.toHaveBeenCalled();
    expect(ch.sendToQueue).not.toHaveBeenCalled();
  });

  it('routes to dead queue and acks once max attempts is reached', async () => {
    const handler: MessageHandler = {
      handle: jest.fn().mockRejectedValue(new Error('still failing')),
    };
    const { sub } = buildSubscriber(handler, makeStore(), 3);
    const ch = makeChannel();
    // x-death entry for the main queue with reason=rejected and count=2 means
    // there have already been 2 retries; the 3rd attempt is happening now.
    const msg = makeMsg({
      body: validEnvelope,
      headers: {
        'x-death': [{ queue: 'q.main', reason: 'rejected', count: 2 }],
      },
    });

    await (sub as unknown as { dispatch(c: ConfirmChannel, m: ConsumeMessage): Promise<void> }).dispatch(ch, msg);

    expect(ch.sendToQueue).toHaveBeenCalledWith(
      'q.main.dead',
      msg.content,
      expect.objectContaining({ persistent: true }),
    );
    expect(ch.ack).toHaveBeenCalledTimes(1);
    expect(ch.nack).not.toHaveBeenCalled();
  });

  it('skips processing when the id was already seen', async () => {
    const handler: MessageHandler = { handle: jest.fn() };
    const idem = makeStore();
    idem.remember('evt-1');
    const { sub } = buildSubscriber(handler, idem);
    const ch = makeChannel();
    const msg = makeMsg({ body: validEnvelope });

    await (sub as unknown as { dispatch(c: ConfirmChannel, m: ConsumeMessage): Promise<void> }).dispatch(ch, msg);

    expect(handler.handle).not.toHaveBeenCalled();
    expect(ch.ack).toHaveBeenCalledTimes(1);
  });

  it('routes malformed payloads straight to dead queue', async () => {
    const handler: MessageHandler = { handle: jest.fn() };
    const { sub } = buildSubscriber(handler);
    const ch = makeChannel();
    const msg = makeMsg({ body: 'not-json{', raw: true });

    await (sub as unknown as { dispatch(c: ConfirmChannel, m: ConsumeMessage): Promise<void> }).dispatch(ch, msg);

    expect(handler.handle).not.toHaveBeenCalled();
    expect(ch.sendToQueue).toHaveBeenCalledWith(
      'q.main.dead',
      msg.content,
      expect.objectContaining({ persistent: true }),
    );
    expect(ch.ack).toHaveBeenCalledTimes(1);
  });
});
