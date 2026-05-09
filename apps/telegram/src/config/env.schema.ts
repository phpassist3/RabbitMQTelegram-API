import * as Joi from 'joi';

export const envSchema = Joi.object({
  TELEGRAM_PORT: Joi.number().port().default(3002),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  TELEGRAM_BOT_TOKEN: Joi.string().min(1).required(),
  TELEGRAM_DEFAULT_CHAT_ID: Joi.string().allow('').optional(),
  TELEGRAM_API_TIMEOUT_MS: Joi.number().integer().min(500).default(8000),
  TELEGRAM_MAX_ATTEMPTS: Joi.number().integer().min(1).default(5),
  TELEGRAM_RETRY_DELAY_MS: Joi.number().integer().min(100).default(5000),
  CONSUMER_PREFETCH: Joi.number().integer().min(1).default(10),
  IDEMPOTENCY_CACHE_SIZE: Joi.number().integer().min(100).default(10_000),
});
