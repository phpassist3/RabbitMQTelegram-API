import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import configuration from './config/configuration';
import { envSchema } from './config/env.schema';
import { MessagingModule } from './messaging/messaging.module';
import { TelegramModule } from './telegram/telegram.module';
import { NotificationsModule } from './notifications/notifications.module';
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
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: parseInt(process.env.TELEGRAM_API_TIMEOUT_MS ?? '8000', 10),
        maxRedirects: 0,
      }),
    }),
    MessagingModule,
    TelegramModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
