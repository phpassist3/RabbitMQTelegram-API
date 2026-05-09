export default () => ({
  app: {
    name: 'consumer',
    port: parseInt(process.env.CONSUMER_PORT ?? '3001', 10),
  },
  rabbit: {
    uri: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    prefetch: parseInt(process.env.CONSUMER_PREFETCH ?? '10', 10),
    maxAttempts: parseInt(process.env.CONSUMER_MAX_ATTEMPTS ?? '5', 10),
    retryDelayMs: parseInt(process.env.CONSUMER_RETRY_DELAY_MS ?? '5000', 10),
  },
  idempotency: {
    cacheSize: parseInt(process.env.IDEMPOTENCY_CACHE_SIZE ?? '10000', 10),
  },
});
