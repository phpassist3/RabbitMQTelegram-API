import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PublisherService } from '../src/messaging/publisher.service';
import { RabbitConnection } from '../src/messaging/rabbit.connection';

describe('Events HTTP API (e2e)', () => {
  let app: INestApplication;
  const publish = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // do not connect to a real broker in tests
      .overrideProvider(RabbitConnection)
      .useValue({ onApplicationBootstrap: jest.fn(), onApplicationShutdown: jest.fn() })
      .overrideProvider(PublisherService)
      .useValue({ publish })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => publish.mockClear());

  it('POST /api/events/notifications publishes and returns 202 with id', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/events/notifications')
      .send({
        type: 'notification.created',
        payload: {
          channel: 'telegram',
          recipient: '12345',
          title: 'Hello',
          message: 'world',
        },
      })
      .expect(202);

    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.body.acceptedAt).toBeDefined();
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('preserves a caller-supplied id', async () => {
    const id = '11111111-2222-4333-8444-555555555555';
    const res = await request(app.getHttpServer())
      .post('/api/events/notifications')
      .send({
        id,
        type: 'notification.created',
        payload: { channel: 'telegram', recipient: '1', message: 'hi' },
      })
      .expect(202);

    expect(res.body.id).toBe(id);
  });

  it('rejects missing required fields with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/events/notifications')
      .send({ payload: { channel: 'telegram', recipient: '1' } })
      .expect(400);

    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects an unknown channel with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/events/notifications')
      .send({
        type: 'notification.created',
        payload: { channel: 'sms', recipient: '1', message: 'hi' },
      })
      .expect(400);
  });

  it('rejects an oversized message with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/events/notifications')
      .send({
        type: 'notification.created',
        payload: {
          channel: 'telegram',
          recipient: '1',
          message: 'x'.repeat(5000),
        },
      })
      .expect(400);
  });
});
