import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiResponse as ApiResponseShape } from '../common/interfaces/api-response.interface';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import {
  CreateDirectConversationDto,
  CreateGroupConversationDto,
  BatchDeleteDto,
  BatchForwardDto,
  EditMessageDto,
  ForwardMessageDto,
  ReactMessageDto,
  SendMessageDto,
  UpdateConversationMemberDto,
  UpsertDraftDto,
} from './dto/chat.dto';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations for current user' })
  async listConversations(
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.listConversations(user.sub);
    return { success: true, data };
  }

  @Post('conversations/direct')
  @ApiOperation({ summary: 'Create or open a direct conversation' })
  async createDirect(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDirectConversationDto,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.createDirectConversation(
      user.sub,
      dto.peer,
    );
    return { success: true, data, message: 'Conversation ready' };
  }

  @Post('conversations/saved')
  @ApiOperation({ summary: 'Get or create Saved Messages conversation' })
  async getSaved(
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.ensureSavedMessages(user.sub);
    return { success: true, data };
  }

  @Post('conversations/group')
  @ApiOperation({ summary: 'Create a group conversation' })
  async createGroup(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateGroupConversationDto,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.createGroupConversation(
      user.sub,
      dto.title,
      dto.memberIds,
    );
    return { success: true, data, message: 'Group created' };
  }

  @Patch('conversations/:id/archive')
  @ApiOperation({ summary: 'Archive or unarchive a conversation' })
  async toggleArchive(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.toggleArchive(user.sub, id);
    return { success: true, data };
  }

  @Patch('conversations/:id')
  @ApiOperation({
    summary: 'Update member settings (mute, pin, archive, mark unread)',
  })
  async updateConversation(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationMemberDto,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.updateMemberSettings(
      user.sub,
      id,
      dto,
    );
    this.chatGateway.emitToUser(user.sub, 'conversation:updated', data);
    return { success: true, data };
  }

  @Put('drafts/:conversationId')
  @ApiOperation({ summary: 'Upsert a draft for a conversation' })
  async upsertDraft(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: UpsertDraftDto,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.upsertDraft(
      user.sub,
      conversationId,
      dto.content,
      dto.replyToId,
    );
    this.chatGateway.emitDraftUpdated(user.sub, data);
    return { success: true, data };
  }

  @Delete('drafts/:conversationId')
  @ApiOperation({ summary: 'Clear a draft for a conversation' })
  async deleteDraft(
    @CurrentUser() user: JwtPayload,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.deleteDraft(user.sub, conversationId);
    this.chatGateway.emitDraftUpdated(user.sub, data);
    return { success: true, data };
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get message history with cursor pagination' })
  async getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.getMessages(
      user.sub,
      id,
      cursor,
      take ? Number(take) : 40,
    );
    return { success: true, data };
  }

  @Get('conversations/:id/pinned')
  @ApiOperation({ summary: 'List pinned messages' })
  async getPinned(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.getPinnedMessages(user.sub, id);
    return { success: true, data };
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message' })
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.createMessage(
      user.sub,
      id,
      dto.content ?? '',
      dto.replyToId,
      {
        type: dto.type,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        durationMs: dto.durationMs,
      },
    );
    await this.chatGateway.broadcastMessage(data);
    return { success: true, data };
  }

  @Post('messages/forward')
  @ApiOperation({ summary: 'Forward a message to another conversation' })
  async forward(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ForwardMessageDto,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.forwardMessage(
      user.sub,
      dto.messageId,
      dto.targetConversationId,
    );
    await this.chatGateway.broadcastMessage(data);
    return { success: true, data };
  }

  @Patch('messages/:id/pin')
  @ApiOperation({ summary: 'Toggle pin on a message' })
  async togglePin(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.togglePin(user.sub, id);
    await this.chatGateway.broadcastMessageUpdate(data);
    return { success: true, data };
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Edit your own text message' })
  async editMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditMessageDto,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.editMessage(user.sub, id, dto.content);
    await this.chatGateway.broadcastMessageUpdate(data);
    return { success: true, data };
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Soft-delete your own message' })
  async deleteMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.deleteMessage(user.sub, id);
    await this.chatGateway.broadcastMessageUpdate(data);
    return { success: true, data };
  }

  @Post('messages/:id/reactions')
  @ApiOperation({ summary: 'Toggle a reaction on a message' })
  async reactMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReactMessageDto,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.toggleReaction(
      user.sub,
      id,
      dto.emoji,
    );
    await this.chatGateway.broadcastMessageUpdate(data);
    return { success: true, data };
  }

  @Post('messages/batch-forward')
  @ApiOperation({ summary: 'Forward multiple messages to a conversation' })
  async batchForward(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BatchForwardDto,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.batchForwardMessages(
      user.sub,
      dto.messageIds,
      dto.targetConversationId,
    );
    for (const message of data) {
      await this.chatGateway.broadcastMessage(message);
    }
    return { success: true, data };
  }

  @Post('messages/batch-delete')
  @ApiOperation({ summary: 'Soft-delete multiple own messages' })
  async batchDelete(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BatchDeleteDto,
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.batchDeleteMessages(
      user.sub,
      dto.messageIds,
    );
    for (const message of data) {
      await this.chatGateway.broadcastMessageUpdate(message);
    }
    return { success: true, data };
  }

  @Get('search')
  @ApiOperation({ summary: 'Global search across users, chats, and messages' })
  async globalSearch(
    @CurrentUser() user: JwtPayload,
    @Query('q') q = '',
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.globalSearch(user.sub, q);
    return { success: true, data };
  }

  @Get('users/search')
  @ApiOperation({ summary: 'Search users to start a chat' })
  async searchUsers(
    @CurrentUser() user: JwtPayload,
    @Query('q') q = '',
  ): Promise<ApiResponseShape<unknown>> {
    const data = await this.chatService.searchUsers(user.sub, q);
    return { success: true, data };
  }
}
