import { ApiProperty } from '@nestjs/swagger';

import { SafeUser } from '../../../utils/sanitize-user';

export class AuthTokensDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty()
  user: SafeUser;

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  sessionId: string;
}
