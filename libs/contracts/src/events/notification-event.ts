import type { EventEnvelope } from './envelope';

export type NotificationChannel = 'telegram';

export interface NotificationPayload {
  channel: NotificationChannel;
  /** chat id (for telegram) or other channel-specific recipient identifier */
  recipient: string;
  title?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export type NotificationEvent = EventEnvelope<NotificationPayload>;
