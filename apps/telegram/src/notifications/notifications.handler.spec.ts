import { ConfigService } from '@nestjs/config';
import type { ConsumeMessage } from 'amqplib';
import { NotificationsHandler } from './notifications.handler';
import { TelegramClient } from '../telegram/telegram.client';

const RAW_MSG = {} as ConsumeMessage; // handler does not inspect raw

function buildHandler(opts: { defaultChatId?: string; sendImpl?: jest.Mock } = {}) {
  const send = opts.sendImpl ?? jest.fn().mockResolvedValue(undefined);
  const client = { sendMessage: send } as unknown as TelegramClient;
  const config = {
    get: (key: string) => (key === 'telegram.defaultChatId' ? opts.defaultChatId : undefined),
  } as unknown as ConfigService;
  return { handler: new NotificationsHandler(client, config), send };
}

const baseEnvelope = {
  id: 'evt-1',
  type: 'notification.created',
  occurredAt: '2026-05-09T00:00:00.000Z',
  source: 'producer',
};

describe('NotificationsHandler', () => {
  it('sends a formatted message to the recipient', async () => {
    const { handler, send } = buildHandler();
    await handler.handle(
      {
        ...baseEnvelope,
        payload: { channel: 'telegram', recipient: '12345', title: 'hi', message: 'world' },
      },
      RAW_MSG,
    );

    expect(send).toHaveBeenCalledTimes(1);
    const [chatId, text] = send.mock.calls[0];
    expect(chatId).toBe('12345');
    expect(text).toContain('<b>hi</b>');
    expect(text).toContain('world');
  });

  it('falls back to the default chat id when recipient is empty', async () => {
    const { handler, send } = buildHandler({ defaultChatId: '999' });
    await handler.handle(
      {
        ...baseEnvelope,
        payload: { channel: 'telegram', recipient: '', message: 'world' },
      },
      RAW_MSG,
    );
    expect(send.mock.calls[0][0]).toBe('999');
  });

  it('throws when there is neither recipient nor default', async () => {
    const { handler } = buildHandler();
    await expect(
      handler.handle(
        {
          ...baseEnvelope,
          payload: { channel: 'telegram', recipient: '', message: 'world' },
        },
        RAW_MSG,
      ),
    ).rejects.toThrow(/no recipient/i);
  });

  it('silently drops events that are not telegram notifications', async () => {
    const { handler, send } = buildHandler();
    await handler.handle(
      {
        ...baseEnvelope,
        payload: { channel: 'sms', recipient: '1', message: 'world' } as unknown as never,
      },
      RAW_MSG,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('propagates client failures so the subscriber retries them', async () => {
    const sendImpl = jest.fn().mockRejectedValue(new Error('telegram api 502: bad gateway'));
    const { handler } = buildHandler({ sendImpl });
    await expect(
      handler.handle(
        {
          ...baseEnvelope,
          payload: { channel: 'telegram', recipient: '1', message: 'msg' },
        },
        RAW_MSG,
      ),
    ).rejects.toThrow(/502/);
  });
});
