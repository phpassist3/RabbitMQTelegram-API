import { Module } from '@nestjs/common';
import { RabbitConnection } from './rabbit.connection';
import { PublisherService } from './publisher.service';

@Module({
  providers: [RabbitConnection, PublisherService],
  exports: [PublisherService],
})
export class MessagingModule {}
