import * as Joi from 'joi';

export const envSchema = Joi.object({
  PRODUCER_PORT: Joi.number().port().default(3000),
  PRODUCER_API_PREFIX: Joi.string().default('api'),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  RABBITMQ_PUBLISH_TIMEOUT_MS: Joi.number().integer().min(100).default(5000),
  RABBITMQ_PUBLISH_RETRIES: Joi.number().integer().min(0).default(5),
  RABBITMQ_PUBLISH_BACKOFF_MS: Joi.number().integer().min(50).default(500),
});
