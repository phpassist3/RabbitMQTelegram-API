import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ROUTING_KEYS, NotificationEvent } from '@app/contracts';
import { PublisherService } from '../messaging/publisher.service';
import { PublishEventDto, PublishEventResponseDto } from './dto/publish-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly publisher: PublisherService) {}

  async publishNotification(dto: PublishEventDto): Promise<PublishEventResponseDto> {
    const id = dto.id ?? randomUUID();
    const occurredAt = new Date().toISOString();

    const envelope: NotificationEvent = {
      id,
      type: dto.type,
      occurredAt,
      source: 'producer',
      payload: dto.payload,
    };

    await this.publisher.publish(envelope, { routingKey: ROUTING_KEYS.notification });

    return { id, acceptedAt: occurredAt };
  }
}
