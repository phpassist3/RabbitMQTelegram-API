import { Module } from '@nestjs/common';
import { RabbitConnection } from './rabbit.connection';

@Module({
  providers: [RabbitConnection],
  exports: [RabbitConnection],
})
export class MessagingModule {}
