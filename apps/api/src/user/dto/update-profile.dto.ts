import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  PRIVACY_FIELDS,
  PRIVACY_VISIBILITIES,
} from '../privacy.constants';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Sara Developer' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  displayName?: string;

  @ApiPropertyOptional({ example: 'sara_dev' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username?: string;

  @ApiPropertyOptional({ example: '/uploads/avatar.png' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 'Building products.' })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  bio?: string | null;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: ['system', 'light', 'dark'] })
  @IsOptional()
  @IsIn(['system', 'light', 'dark'])
  theme?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sendOnEnter?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  messagePreview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  desktopNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @ApiPropertyOptional({ enum: ['full', 'power-saver', 'none'] })
  @IsOptional()
  @IsIn(['full', 'power-saver', 'none'])
  animationLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoDownloadPhotos?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoDownloadVideos?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoDownloadFiles?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  saveToGallery?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(12)
  @Max(24)
  fontSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  chatBackground?: string | null;
}

export class UpdatePrivacyDto {
  @ApiProperty({ enum: PRIVACY_FIELDS })
  @IsString()
  @IsIn([...PRIVACY_FIELDS])
  field: string;

  @ApiProperty({ enum: PRIVACY_VISIBILITIES })
  @IsString()
  @IsIn([...PRIVACY_VISIBILITIES])
  visibility: string;
}

export class DeleteAccountDto {
  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
