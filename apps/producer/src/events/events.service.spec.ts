import { Test } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PublisherService } from '../messaging/publisher.service';
import { ROUTING_KEYS } from '@app/contracts';

describe('EventsService', () => {
  let service: EventsService;
  let publish: jest.Mock;

  beforeEach(async () => {
    publish = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PublisherService, useValue: { publish } },
      ],
    }).compile();
    service = moduleRef.get(EventsService);
  });

  it('generates an id when none is supplied', async () => {
    const result = await service.publishNotification({
      type: 'notification.created',
      payload: { channel: 'telegram', recipient: '42', message: 'hi' },
    });

    expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.acceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(publish).toHaveBeenCalledTimes(1);
    const [envelope, opts] = publish.mock.calls[0];
    expect(envelope.id).toBe(result.id);
    expect(envelope.source).toBe('producer');
    expect(opts.routingKey).toBe(ROUTING_KEYS.notification);
  });

  it('preserves a caller-supplied id', async () => {
    const id = '11111111-2222-4333-8444-555555555555';
    const result = await service.publishNotification({
      id,
      type: 'notification.created',
      payload: { channel: 'telegram', recipient: '42', message: 'hi' },
    });
    expect(result.id).toBe(id);
    expect(publish.mock.calls[0][0].id).toBe(id);
  });

  it('propagates publisher failures', async () => {
    publish.mockRejectedValueOnce(new Error('broker unreachable'));
    await expect(
      service.publishNotification({
        type: 'notification.created',
        payload: { channel: 'telegram', recipient: '42', message: 'hi' },
      }),
    ).rejects.toThrow('broker unreachable');
  });
});
