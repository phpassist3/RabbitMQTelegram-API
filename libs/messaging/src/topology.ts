import type { Channel } from 'amqplib';
import { EXCHANGES } from '@app/contracts';

/**
 * Topology used by every subscriber:
 *
 *   events.x (topic)
 *      └─ <queue> ──fail (nack/no-requeue)──┐
 *                                           ▼
 *                                    <queue>.retry (TTL)
 *                                           │
 *                            ttl expires    │  (DLX="" + DLR=<queue>)
 *                                           ▼
 *                                       <queue>
 *
 * Dead-letter routing uses the default exchange ("") and the queue name as the
 * routing key — the simplest way to dead-letter directly to a specific queue.
 */
export interface ConsumerTopology {
  queue: string;
  retryQueue: string;
  deadQueue: string;
  retryTtlMs: number;
  bindings: Array<{ exchange: string; routingKey: string }>;
}

export async function assertConsumerTopology(channel: Channel, t: ConsumerTopology): Promise<void> {
  await channel.assertExchange(EXCHANGES.events, 'topic', { durable: true });

  await channel.assertQueue(t.retryQueue, {
    durable: true,
    arguments: {
      'x-message-ttl': t.retryTtlMs,
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': t.queue,
    },
  });

  await channel.assertQueue(t.queue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': t.retryQueue,
    },
  });

  await channel.assertQueue(t.deadQueue, { durable: true });

  for (const b of t.bindings) {
    await channel.bindQueue(t.queue, b.exchange, b.routingKey);
  }
}
