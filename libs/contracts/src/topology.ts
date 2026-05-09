// Single source of truth for the broker topology shared between producer and consumers.
// Keeping it in a lib avoids drift between services when names change.

export const EXCHANGES = {
  events: 'events.x',
} as const;

export const QUEUES = {
  processor: 'events.processor.q',
  processorRetry: 'events.processor.retry.q',
  processorDead: 'events.processor.dead.q',

  telegram: 'events.telegram.q',
  telegramRetry: 'events.telegram.retry.q',
  telegramDead: 'events.telegram.dead.q',
} as const;

export const ROUTING_KEYS = {
  // anything matching event.# is fanned out to processor and telegram
  notification: 'event.notification',
  // catch-all binding pattern
  any: 'event.#',
} as const;

export const HEADERS = {
  eventId: 'x-event-id',
  eventType: 'x-event-type',
  occurredAt: 'x-occurred-at',
} as const;

export type ExchangeName = (typeof EXCHANGES)[keyof typeof EXCHANGES];
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
