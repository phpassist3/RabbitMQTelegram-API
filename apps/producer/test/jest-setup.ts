// Jest runs this file before evaluating any test module, so it sets the env
// vars that the producer's Joi validation expects without needing the test
// to set them in beforeAll (which would already be too late).
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
process.env.PRODUCER_PORT = process.env.PRODUCER_PORT ?? '0';
process.env.PRODUCER_API_PREFIX = process.env.PRODUCER_API_PREFIX ?? 'api';
