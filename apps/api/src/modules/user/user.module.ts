import { Module, forwardRef } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';

import { UserController } from './controllers/user.controller';
import { BlockService } from './services/block.service';
import { PreferenceService } from './services/preference.service';
import { PrivacyService } from './services/privacy.service';
import { UserService } from './services/user.service';

@Module({
  imports: [forwardRef(() => ChatModule)],
  controllers: [UserController],
  providers: [UserService, PreferenceService, PrivacyService, BlockService],
  exports: [UserService, PrivacyService, BlockService],
})
export class UserModule {}
