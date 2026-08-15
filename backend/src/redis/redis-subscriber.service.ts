import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { AccessEventsService } from '../access-events/access-events.service';
import { REDIS_SUBSCRIBER_CLIENT } from './redis.constants';

/**
 * Subscribes to the recognition-events channel the Python service publishes
 * to (README Section 6 / docs/phase1.md Redis contract) and routes each
 * message into AccessEventsService.
 */
@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private readonly channel =
    process.env.REDIS_RECOGNITION_CHANNEL ?? 'gate:recognition-events';
  private lastMessageAt: Date | null = null;

  constructor(
    @Inject(REDIS_SUBSCRIBER_CLIENT) private readonly subscriber: Redis,
    private readonly accessEventsService: AccessEventsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.subscriber.subscribe(this.channel);
    // ioredis's `on('message', ...)` expects a void-returning listener;
    // errors from handleMessage are caught and logged here instead of
    // being returned as an unhandled promise rejection.
    this.subscriber.on('message', (channel: string, message: string) => {
      this.onMessage(channel, message);
    });
    this.logger.log(`Subscribed to Redis channel "${this.channel}"`);
  }

  onMessage(channel: string, message: string): void {
    if (channel !== this.channel) return;
    this.handleMessage(message).catch((error: unknown) => {
      this.logger.error(`Error handling recognition event: ${String(error)}`);
    });
  }

  async handleMessage(message: string): Promise<void> {
    let payload: unknown;
    try {
      payload = JSON.parse(message);
    } catch {
      this.logger.warn(
        `Discarding non-JSON message on ${this.channel}: ${message}`,
      );
      return;
    }
    this.lastMessageAt = new Date();
    await this.accessEventsService.handleRawEvent(payload);
  }

  /** Used by HealthService as a proxy for "is the Python recognition service
   * alive" - there is no HTTP server on that side to ping directly. */
  getLastMessageAt(): Date | null {
    return this.lastMessageAt;
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.unsubscribe(this.channel);
    this.subscriber.disconnect();
  }
}
