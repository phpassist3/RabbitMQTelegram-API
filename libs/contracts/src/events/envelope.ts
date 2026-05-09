/**
 * Wire format for every message that travels through the broker.
 * Producer fills in id/occurredAt/source; consumers must treat unknown fields as forward-compatible.
 */
export interface EventEnvelope<TPayload> {
  /** UUID v4. Used by consumers for idempotency. */
  id: string;
  /** Discriminator like `notification.created` */
  type: string;
  /** ISO-8601 UTC timestamp produced at publish time */
  occurredAt: string;
  /** Logical name of the producer */
  source: string;
  payload: TPayload;
}

export function isEventEnvelope(value: unknown): value is EventEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.type === 'string' &&
    typeof v.occurredAt === 'string' &&
    typeof v.source === 'string' &&
    'payload' in v
  );
}
