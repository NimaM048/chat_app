import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly redis: Redis | null;
  private enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL')?.trim();

    if (!redisUrl) {
      this.redis = null;
      this.enabled = false;
      return;
    }

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    this.enabled = true;

    this.redis.on('error', (error) => {
      this.logger.warn(`Redis error: ${error.message}`);
      this.enabled = false;
    });

    this.redis.connect().catch((error: Error) => {
      this.logger.warn(`Redis connection failed: ${error.message}`);
      this.enabled = false;
    });
  }

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    if (!this.enabled || !this.redis) {
      return { allowed: true, remaining: limit };
    }

    try {
      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, windowSeconds);
      }

      return {
        allowed: current <= limit,
        remaining: Math.max(limit - current, 0),
      };
    } catch (error) {
      this.logger.warn(
        `Rate limit check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      this.enabled = false;
      return { allowed: true, remaining: limit };
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }
}
