import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiResponse as ApiResponseShape } from '../common/interfaces/api-response.interface';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { SafeUser } from '../common/utils/sanitize-user';
import { ChatGateway } from '../chat/chat.gateway';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<ApiResponseShape<AuthResponseDto>> {
    const result = await this.authService.register(
      dto,
      ip ?? 'unknown',
      userAgent,
    );

    return {
      success: true,
      data: result,
      message: 'Registration successful',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email or username' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<ApiResponseShape<AuthResponseDto>> {
    const result = await this.authService.login(
      dto,
      ip ?? 'unknown',
      userAgent,
    );

    return {
      success: true,
      data: result,
      message: 'Login successful',
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<ApiResponseShape<AuthResponseDto>> {
    const result = await this.authService.refresh(dto.refreshToken);

    return {
      success: true,
      data: result,
      message: 'Token refreshed',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(
    @Body() dto: RefreshTokenDto,
  ): Promise<ApiResponseShape<{ loggedOut: boolean }>> {
    await this.authService.logout(dto.refreshToken);

    return {
      success: true,
      data: { loggedOut: true },
      message: 'Logout successful',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async me(
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseShape<SafeUser>> {
    const profile = await this.authService.getProfile(user.sub);

    return {
      success: true,
      data: profile,
    };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions for current user' })
  async listSessions(@CurrentUser() user: JwtPayload) {
    const data = await this.authService.listSessions(user.sub, user.sid);
    return { success: true, data };
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.authService.revokeSession(user.sub, id);
    this.chatGateway.emitToUser(user.sub, 'session:revoked', {
      sessionId: id,
    });
    return { success: true, data, message: 'Session revoked' };
  }

  @Post('sessions/revoke-others')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions except the current one' })
  async revokeOtherSessions(@CurrentUser() user: JwtPayload) {
    const data = await this.authService.revokeOtherSessions(
      user.sub,
      user.sid,
    );
    this.chatGateway.emitToUser(user.sub, 'session:revoked', {
      sessionId: null,
      others: true,
      currentSessionId: user.sid ?? null,
    });
    return { success: true, data, message: 'Other sessions revoked' };
  }
}
