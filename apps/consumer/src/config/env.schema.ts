import * as Joi from 'joi';

export const envSchema = Joi.object({
  CONSUMER_PORT: Joi.number().port().default(3001),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  CONSUMER_PREFETCH: Joi.number().integer().min(1).default(10),
  CONSUMER_MAX_ATTEMPTS: Joi.number().integer().min(1).default(5),
  CONSUMER_RETRY_DELAY_MS: Joi.number().integer().min(100).default(5000),
  IDEMPOTENCY_CACHE_SIZE: Joi.number().integer().min(100).default(10_000),
});
