import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiResponse as ApiResponseShape } from '../../../shared/interfaces/api-response.interface';
import { JwtPayload } from '../../../shared/interfaces/jwt-payload.interface';
import { SafeUser } from '../../../utils/sanitize-user';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ChatGateway } from '../../chat/gateways/chat.gateway';
import { PresenceService } from '../../chat/services/presence.service';
import {
  DeleteAccountDto,
  UpdatePreferencesDto,
  UpdatePrivacyDto,
  UpdateProfileDto,
} from '../dto/update-profile.dto';
import { BlockService } from '../services/block.service';
import { PreferenceService } from '../services/preference.service';
import { PrivacyService } from '../services/privacy.service';
import { UserService } from '../services/user.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly preferenceService: PreferenceService,
    private readonly privacyService: PrivacyService,
    private readonly blockService: BlockService,
    private readonly presenceService: PresenceService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<ApiResponseShape<SafeUser>> {
    const data = await this.userService.updateProfile(user.sub, dto);
    return { success: true, data, message: 'Profile updated' };
  }

  @Delete('me')
  @ApiOperation({ summary: 'Permanently delete current account' })
  async deleteMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DeleteAccountDto,
  ): Promise<ApiResponseShape<{ deleted: true }>> {
    await this.userService.deleteAccount(user.sub, dto);
    this.chatGateway.emitToUser(user.sub, 'session:revoked', {
      reason: 'account_deleted',
      allSessions: true,
    });
    return {
      success: true,
      data: { deleted: true },
      message: 'Account deleted',
    };
  }

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get user preferences' })
  async getPreferences(@CurrentUser() user: JwtPayload) {
    const data = await this.preferenceService.getOrCreatePreferences(user.sub);
    return { success: true, data };
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  async updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePreferencesDto,
  ) {
    const data = await this.preferenceService.updatePreferences(user.sub, dto);
    return { success: true, data };
  }

  @Get('me/privacy')
  @ApiOperation({ summary: 'Get privacy settings' })
  async getPrivacy(@CurrentUser() user: JwtPayload) {
    const data = await this.privacyService.getPrivacy(user.sub);
    return { success: true, data };
  }

  @Patch('me/privacy')
  @ApiOperation({ summary: 'Update one privacy field' })
  async updatePrivacy(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePrivacyDto,
  ) {
    const data = await this.privacyService.updatePrivacy(user.sub, dto);
    return { success: true, data };
  }

  @Get('me/blocks')
  @ApiOperation({ summary: 'List blocked users' })
  async listBlocks(@CurrentUser() user: JwtPayload) {
    const data = await this.blockService.listBlocked(user.sub);
    return { success: true, data };
  }

  @Post('me/blocks/:userId')
  @ApiOperation({ summary: 'Block a user' })
  async blockUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    const data = await this.blockService.blockUser(user.sub, userId);
    return { success: true, data };
  }

  @Delete('me/blocks/:userId')
  @ApiOperation({ summary: 'Unblock a user' })
  async unblockUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    const data = await this.blockService.unblockUser(user.sub, userId);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public profile for a user (viewer-aware)' })
  async getPublicProfile(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const isOnline = await this.presenceService.isOnline(id);
    const data = await this.privacyService.toPublicProfile(user.sub, id, {
      isOnline,
    });
    return { success: true, data };
  }
}
