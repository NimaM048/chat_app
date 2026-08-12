import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeviceInfoDto {
  @ApiPropertyOptional({ example: 'browser-abc-123' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  @ApiPropertyOptional({ example: 'Chrome on Windows' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceName?: string;

  @ApiPropertyOptional({
    example: 'web',
    enum: ['web', 'desktop', 'android', 'ios'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;
}
