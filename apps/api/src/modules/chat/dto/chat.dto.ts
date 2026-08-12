import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateDirectConversationDto {
  @ApiProperty({ description: 'Target user id or username' })
  @IsString()
  @IsNotEmpty()
  peer: string;
}

export class SendMessageDto {
  @ApiPropertyOptional()
  @ValidateIf((dto: SendMessageDto) => !dto.fileUrl)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @ApiPropertyOptional({ enum: MessageType })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;
}

export class ForwardMessageDto {
  @ApiProperty()
  @IsUUID()
  messageId: string;

  @ApiProperty()
  @IsUUID()
  targetConversationId: string;
}

export class EditMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}

export class ReactMessageDto {
  @ApiProperty({ example: '👍' })
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  emoji: string;
}

export class CreateGroupConversationDto {
  @ApiProperty({ example: 'Weekend plans' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  title: string;

  @ApiProperty({
    description: 'Usernames or ids of members to add (excluding yourself)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  memberIds: string[];
}

export class BatchForwardDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  messageIds: string[];

  @ApiProperty()
  @IsUUID()
  targetConversationId: string;
}

export class BatchDeleteDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  messageIds: string[];
}

export class UpdateConversationMemberDto {
  @ApiPropertyOptional({
    description: 'ISO date to mute until, or null to unmute',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  mutedUntil?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  markedUnread?: boolean;
}

export class UpsertDraftDto {
  @ApiProperty({ description: 'Empty string clears the draft' })
  @IsString()
  @MaxLength(4000)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replyToId?: string | null;
}
