import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class NotificationPayloadDto {
  @ApiProperty({ enum: ['telegram'], example: 'telegram' })
  @IsIn(['telegram'])
  channel!: 'telegram';

  @ApiProperty({ example: '-1001234567890', description: 'telegram chat id' })
  @IsString()
  @IsNotEmpty()
  recipient!: string;

  @ApiPropertyOptional({ example: 'Order placed' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string;

  @ApiProperty({ example: 'Order #42 placed for user@example.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { orderId: 42, source: 'web' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PublishEventDto {
  @ApiPropertyOptional({
    description: 'caller-supplied id (uuid v4); generated server-side if omitted',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID(4)
  id?: string;

  @ApiProperty({ example: 'notification.created' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  type!: string;

  @ApiProperty({ type: NotificationPayloadDto })
  @ValidateNested()
  @Type(() => NotificationPayloadDto)
  payload!: NotificationPayloadDto;
}

export class PublishEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-05-09T10:21:33.000Z' })
  acceptedAt!: string;
}
