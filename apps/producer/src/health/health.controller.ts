import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  ping() {
    return { status: 'ok', uptime: process.uptime(), ts: new Date().toISOString() };
  }
}
