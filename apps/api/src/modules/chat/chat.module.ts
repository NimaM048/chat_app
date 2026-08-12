import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UserModule } from '../user/user.module';

import { ChatController } from './controllers/chat.controller';
import { ChatGateway } from './gateways/chat.gateway';
import { ChatMapperService } from './services/chat-mapper.service';
import { ConversationService } from './services/conversation.service';
import { DraftService } from './services/draft.service';
import { MessageService } from './services/message.service';
import { PresenceService } from './services/presence.service';
import { ReactionService } from './services/reaction.service';
import { SearchService } from './services/search.service';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => UserModule)],
  controllers: [ChatController],
  providers: [
    ChatMapperService,
    ConversationService,
    MessageService,
    DraftService,
    ReactionService,
    SearchService,
    PresenceService,
    ChatGateway,
  ],
  exports: [ConversationService, MessageService, ChatGateway, PresenceService],
})
export class ChatModule {}
