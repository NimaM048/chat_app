import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, Set<string>>();

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL')?.trim();
    if (!redisUrl) {
      this.redis = null;
      return;
    }

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });

    this.redis.on('error', (error) => {
      this.logger.warn(`Redis presence error: ${error.message}`);
    });

    this.redis.connect().catch((error: Error) => {
      this.logger.warn(`Redis presence unavailable: ${error.message}`);
    });
  }

  async setOnline(userId: string, socketId: string) {
    if (this.redis?.status === 'ready') {
      await this.redis.sadd(`presence:${userId}`, socketId);
      await this.redis.set(`presence:online:${userId}`, '1');
      return;
    }

    const sockets = this.memory.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    this.memory.set(userId, sockets);
  }

  async setOffline(userId: string, socketId: string): Promise<boolean> {
    if (this.redis?.status === 'ready') {
      await this.redis.srem(`presence:${userId}`, socketId);
      const remaining = await this.redis.scard(`presence:${userId}`);
      if (remaining === 0) {
        await this.redis.del(`presence:online:${userId}`);
        return true;
      }
      return false;
    }

    const sockets = this.memory.get(userId);
    if (!sockets) {
      return true;
    }

    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.memory.delete(userId);
      return true;
    }

    return false;
  }

  async isOnline(userId: string): Promise<boolean> {
    if (this.redis?.status === 'ready') {
      const value = await this.redis.get(`presence:online:${userId}`);
      return value === '1';
    }

    return (this.memory.get(userId)?.size ?? 0) > 0;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }
}
