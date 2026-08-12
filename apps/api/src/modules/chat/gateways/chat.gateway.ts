import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { MessageType } from '@prisma/client';
import { Server, Socket } from 'socket.io';

import { PrismaService } from '../../../database/prisma.service';
import { JwtPayload } from '../../../shared/interfaces/jwt-payload.interface';
import { resolveCorsOrigin } from '../../../utils/cors-origin';
import { PrivacyService } from '../../user/services/privacy.service';
import { UserService } from '../../user/services/user.service';
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';
import { PresenceService } from '../services/presence.service';

type AuthedSocket = Socket & { data: { user?: JwtPayload } };

function socketUser(client: AuthedSocket): JwtPayload | undefined {
  return (client.data as { user?: JwtPayload }).user;
}

function setSocketUser(client: AuthedSocket, user: JwtPayload): void {
  const data = client.data as { user?: JwtPayload };
  data.user = user;
}

@WebSocketGateway({
  cors: {
    origin: resolveCorsOrigin(process.env.CORS_ORIGIN),
    credentials: true,
  },
  namespace: '/ws',
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly presenceService: PresenceService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => PrivacyService))
    private readonly privacyService: PrivacyService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      if (!payload.sub || !payload.sid) {
        client.disconnect();
        return;
      }

      const session = await this.prisma.refreshToken.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!session) {
        client.disconnect();
        return;
      }

      setSocketUser(client, payload);
      await client.join(this.userRoom(payload.sub));
      await this.presenceService.setOnline(payload.sub, client.id);
      await this.emitPresenceUpdate(payload.sub, true);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    const user = socketUser(client);
    if (!user) {
      return;
    }

    const wentOffline = await this.presenceService.setOffline(
      user.sub,
      client.id,
    );

    if (wentOffline) {
      const lastSeenAt = await this.userService.touchLastSeen(user.sub);
      await this.emitPresenceUpdate(user.sub, false, lastSeenAt.toISOString());
    }
  }

  async broadcastMessage(message: {
    id: string;
    conversationId: string;
    senderId?: string;
    content?: string;
    [key: string]: unknown;
  }) {
    this.server
      .to(this.conversationRoom(message.conversationId))
      .emit('message:new', message);

    const memberIds = await this.conversationService.getMemberIds(
      message.conversationId,
    );
    for (const memberId of memberIds) {
      const policy = await this.userService.getMemberNotifyPolicy(
        memberId,
        message.conversationId,
      );
      const isSender = memberId === message.senderId;
      const suppressNotification = isSender || policy.suppressNotification;
      const notificationPreview =
        suppressNotification || !policy.messagePreview
          ? null
          : typeof message.content === 'string'
            ? message.content
            : null;

      const envelope = {
        ...message,
        suppressNotification,
        notificationPreview,
        soundEnabled: policy.soundEnabled && !suppressNotification,
      };

      this.server.to(this.userRoom(memberId)).emit('conversation:updated', {
        conversationId: message.conversationId,
        lastMessage: envelope,
        suppressNotification,
        notificationPreview,
      });
      this.server.to(this.userRoom(memberId)).emit('message:new', envelope);
    }
  }

  async broadcastMessageUpdate(message: {
    id: string;
    conversationId: string;
    [key: string]: unknown;
  }) {
    this.server
      .to(this.conversationRoom(message.conversationId))
      .emit('message:updated', message);

    const memberIds = await this.conversationService.getMemberIds(
      message.conversationId,
    );
    for (const memberId of memberIds) {
      this.server.to(this.userRoom(memberId)).emit('message:updated', message);
    }
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = socketUser(client);
    if (!user) {
      return { ok: false };
    }

    await this.messageService.getMessages(
      user.sub,
      body.conversationId,
      undefined,
      1,
    );
    await client.join(this.conversationRoom(body.conversationId));
    return { ok: true };
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: {
      conversationId: string;
      content?: string;
      replyToId?: string;
      type?: MessageType;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      durationMs?: number;
    },
  ) {
    const user = socketUser(client);
    if (!user) {
      return { ok: false };
    }

    const message = await this.messageService.createMessage(
      user.sub,
      body.conversationId,
      body.content ?? '',
      body.replyToId,
      {
        type: body.type,
        fileUrl: body.fileUrl,
        fileName: body.fileName,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
        durationMs: body.durationMs,
      },
    );

    await this.broadcastMessage(message);
    return { ok: true, message };
  }

  @SubscribeMessage('typing:start')
  typingStart(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = socketUser(client);
    if (!user) return;

    client
      .to(this.conversationRoom(body.conversationId))
      .emit('typing:update', {
        conversationId: body.conversationId,
        userId: user.sub,
        username: user.username,
        isTyping: true,
      });
  }

  @SubscribeMessage('typing:stop')
  typingStop(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = socketUser(client);
    if (!user) return;

    client
      .to(this.conversationRoom(body.conversationId))
      .emit('typing:update', {
        conversationId: body.conversationId,
        userId: user.sub,
        username: user.username,
        isTyping: false,
      });
  }

  @SubscribeMessage('message:delivered')
  async messageDelivered(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { messageId: string },
  ) {
    const user = socketUser(client);
    if (!user) {
      return { ok: false };
    }

    const message = await this.messageService.markDelivered(
      body.messageId,
      user.sub,
    );
    this.server
      .to(this.conversationRoom(message.conversationId))
      .emit('message:status', message);
    return { ok: true, message };
  }

  @SubscribeMessage('conversation:seen')
  async conversationSeen(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const user = socketUser(client);
    if (!user) {
      return { ok: false };
    }

    const result = await this.messageService.markConversationSeen(
      user.sub,
      body.conversationId,
    );

    this.server
      .to(this.conversationRoom(body.conversationId))
      .emit('conversation:seen', result);

    return { ok: true, ...result };
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(this.userRoom(userId)).emit(event, payload);
  }

  emitDraftUpdated(
    userId: string,
    payload: {
      conversationId: string;
      content: string | null;
      updatedAt: string | null;
    },
  ) {
    this.emitToUser(userId, 'draft:updated', payload);
  }

  private async emitPresenceUpdate(
    userId: string,
    online: boolean,
    lastSeenAt?: string | null,
  ) {
    const recipients =
      await this.privacyService.getPresenceRecipientIds(userId);
    const payload = {
      userId,
      online,
      lastSeenAt: online ? null : (lastSeenAt ?? null),
    };
    for (const recipientId of recipients) {
      this.server
        .to(this.userRoom(recipientId))
        .emit('presence:update', payload);
    }
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private conversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }
}
