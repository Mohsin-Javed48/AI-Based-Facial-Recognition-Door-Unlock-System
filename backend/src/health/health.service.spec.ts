import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { RedisSubscriberService } from '../redis/redis-subscriber.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  const prisma = { $queryRaw: jest.fn() };
  const redis = { ping: jest.fn() };
  const redisSubscriber = { getLastMessageAt: jest.fn() };
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.PYTHON_SERVICE_STALE_AFTER_SECONDS = '30';
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: RedisSubscriberService, useValue: redisSubscriber },
      ],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reports "ok" when postgres and redis are both reachable', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');
    redisSubscriber.getLastMessageAt.mockReturnValue(null);

    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(report.checks.postgres.status).toBe('up');
    expect(report.checks.redis.status).toBe('up');
  });

  it('reports "degraded" when postgres is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    redis.ping.mockResolvedValue('PONG');
    redisSubscriber.getLastMessageAt.mockReturnValue(null);

    const report = await service.check();

    expect(report.status).toBe('degraded');
    expect(report.checks.postgres).toEqual({
      status: 'down',
      message: 'connection refused',
    });
  });

  it('reports "degraded" when redis is unreachable', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockRejectedValue(new Error('ECONNREFUSED'));
    redisSubscriber.getLastMessageAt.mockReturnValue(null);

    const report = await service.check();

    expect(report.status).toBe('degraded');
    expect(report.checks.redis.status).toBe('down');
  });

  it('reports the recognition service as "unknown" before any event has arrived', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');
    redisSubscriber.getLastMessageAt.mockReturnValue(null);

    const report = await service.check();

    // "unknown" must not drag the overall status down to "degraded".
    expect(report.checks.recognitionService.status).toBe('unknown');
    expect(report.status).toBe('ok');
  });

  it('reports the recognition service as "up" for a recent event', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');
    redisSubscriber.getLastMessageAt.mockReturnValue(
      new Date(Date.now() - 5_000),
    );

    const report = await service.check();

    expect(report.checks.recognitionService.status).toBe('up');
    expect(
      report.checks.recognitionService.lastEventSecondsAgo,
    ).toBeLessThanOrEqual(6);
  });

  it('reports the recognition service as "down" once its last event is stale', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');
    redisSubscriber.getLastMessageAt.mockReturnValue(
      new Date(Date.now() - 60_000),
    );

    const report = await service.check();

    expect(report.checks.recognitionService.status).toBe('down');
  });
});
