export default () => ({
  app: {
    name: 'producer',
    port: parseInt(process.env.PRODUCER_PORT ?? '3000', 10),
    apiPrefix: process.env.PRODUCER_API_PREFIX ?? 'api',
  },
  rabbit: {
    uri: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    publishTimeoutMs: parseInt(process.env.RABBITMQ_PUBLISH_TIMEOUT_MS ?? '5000', 10),
    publishRetries: parseInt(process.env.RABBITMQ_PUBLISH_RETRIES ?? '5', 10),
    publishBackoffMs: parseInt(process.env.RABBITMQ_PUBLISH_BACKOFF_MS ?? '500', 10),
  },
});
