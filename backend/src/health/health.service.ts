import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../common/prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { RedisSubscriberService } from '../redis/redis-subscriber.service';

export interface ServiceCheck {
  status: 'up' | 'down' | 'unknown';
  message?: string;
  lastEventSecondsAgo?: number;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  checks: {
    postgres: ServiceCheck;
    redis: ServiceCheck;
    recognitionService: ServiceCheck;
  };
  timestamp: string;
}

/**
 * README Section 15. There is no HTTP server on the Python recognition
 * service to ping directly (it's a foreground webcam script, see
 * recognition/scripts/run_webcam.py), so its liveness is inferred from how
 * recently a recognition event arrived over Redis. "unknown" (not yet
 * received any event since backend startup) is intentionally distinct from
 * "down" and does not count against the overall status.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly redisSubscriber: RedisSubscriberService,
  ) {}

  async check(): Promise<HealthReport> {
    const [postgres, redis] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ]);
    const recognitionService = this.checkRecognitionService();

    const status =
      postgres.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded';

    return {
      status,
      checks: { postgres, redis, recognitionService },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkPostgres(): Promise<ServiceCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', message: (error as Error).message };
    }
  }

  private async checkRedis(): Promise<ServiceCheck> {
    try {
      await this.redis.ping();
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', message: (error as Error).message };
    }
  }

  private checkRecognitionService(): ServiceCheck {
    const lastMessageAt = this.redisSubscriber.getLastMessageAt();
    if (!lastMessageAt) {
      return {
        status: 'unknown',
        message: 'No recognition event received since backend startup.',
      };
    }

    const staleAfterSeconds = Number(
      process.env.PYTHON_SERVICE_STALE_AFTER_SECONDS ?? 30,
    );
    const ageSeconds = Math.round(
      (Date.now() - lastMessageAt.getTime()) / 1000,
    );
    return {
      status: ageSeconds <= staleAfterSeconds ? 'up' : 'down',
      lastEventSecondsAgo: ageSeconds,
    };
  }
}
