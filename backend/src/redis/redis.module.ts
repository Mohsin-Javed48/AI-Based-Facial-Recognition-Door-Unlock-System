import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { AccessEventsModule } from '../access-events/access-events.module';
import { REDIS_CLIENT, REDIS_SUBSCRIBER_CLIENT } from './redis.constants';
import { RedisSubscriberService } from './redis-subscriber.service';

const redisUrl = () => process.env.REDIS_URL ?? 'redis://localhost:6379';

@Global()
@Module({
  imports: [AccessEventsModule],
  providers: [
    { provide: REDIS_CLIENT, useFactory: () => new Redis(redisUrl()) },
    {
      provide: REDIS_SUBSCRIBER_CLIENT,
      useFactory: () => new Redis(redisUrl()),
    },
    RedisSubscriberService,
  ],
  exports: [REDIS_CLIENT, RedisSubscriberService],
})
export class RedisModule {}
