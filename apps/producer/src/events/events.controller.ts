import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import {
  PublishEventDto,
  PublishEventResponseDto,
} from './dto/publish-event.dto';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post('notifications')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Publish a notification event to the broker' })
  @ApiResponse({ status: 202, description: 'event accepted', type: PublishEventResponseDto })
  @ApiResponse({ status: 400, description: 'validation failed' })
  @ApiResponse({ status: 503, description: 'broker unreachable after retries' })
  async publishNotification(@Body() dto: PublishEventDto): Promise<PublishEventResponseDto> {
    return this.events.publishNotification(dto);
  }
}
