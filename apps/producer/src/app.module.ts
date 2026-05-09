import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envSchema } from './config/env.schema';
import { MessagingModule } from './messaging/messaging.module';
import { EventsModule } from './events/events.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: envSchema,
      validationOptions: { abortEarly: true, allowUnknown: true },
    }),
    MessagingModule,
    EventsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
