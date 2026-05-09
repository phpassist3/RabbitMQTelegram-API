import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [MessagingModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
