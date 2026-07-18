import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PresenceService } from './presence.service';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => UserModule)],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, PresenceService],
  exports: [ChatService, ChatGateway, PresenceService],
})
export class ChatModule {}
