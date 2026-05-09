export default () => ({
  app: {
    name: 'telegram',
    port: parseInt(process.env.TELEGRAM_PORT ?? '3002', 10),
  },
  rabbit: {
    uri: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    prefetch: parseInt(process.env.CONSUMER_PREFETCH ?? '10', 10),
    maxAttempts: parseInt(process.env.TELEGRAM_MAX_ATTEMPTS ?? '5', 10),
    retryDelayMs: parseInt(process.env.TELEGRAM_RETRY_DELAY_MS ?? '5000', 10),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID || undefined,
    apiTimeoutMs: parseInt(process.env.TELEGRAM_API_TIMEOUT_MS ?? '8000', 10),
  },
  idempotency: {
    cacheSize: parseInt(process.env.IDEMPOTENCY_CACHE_SIZE ?? '10000', 10),
  },
});
