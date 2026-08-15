import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AccessLogsService } from './access-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';

interface FindManyArgs {
  where: { memberId?: string; timestamp?: { gte?: Date; lte?: Date } };
  take: number;
  skip: number;
}

describe('AccessLogsService', () => {
  let service: AccessLogsService;
  const prisma = {
    accessLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccessLogsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AccessLogsService);
  });

  it('creates a log entry', async () => {
    const input = {
      timestamp: new Date('2026-01-01T00:00:00Z'),
      memberId: '1',
      matchedName: 'Ali',
      confidence: 0.9,
      snapshotPath: null,
      action: 'AUTO_OPENED' as const,
      eventType: 'FACE_RECOGNIZED' as const,
    };
    prisma.accessLog.create.mockResolvedValue({ id: 'log1', ...input });

    const result = await service.create(input);

    expect(prisma.accessLog.create).toHaveBeenCalledWith({ data: input });
    expect(result.id).toBe('log1');
  });

  it('filters by memberId', async () => {
    prisma.accessLog.findMany.mockResolvedValue([]);
    prisma.accessLog.count.mockResolvedValue(0);

    await service.findAll({ memberId: '11111111-1111-1111-1111-111111111111' });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- untyped jest.fn() mock
    const args = prisma.accessLog.findMany.mock.calls[0][0] as FindManyArgs;
    expect(args.where.memberId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('filters by date range', async () => {
    prisma.accessLog.findMany.mockResolvedValue([]);
    prisma.accessLog.count.mockResolvedValue(0);

    await service.findAll({ dateFrom: '2026-01-01', dateTo: '2026-01-31' });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- untyped jest.fn() mock
    const args = prisma.accessLog.findMany.mock.calls[0][0] as FindManyArgs;
    expect(args.where.timestamp?.gte).toEqual(new Date('2026-01-01'));
    expect(args.where.timestamp?.lte).toEqual(new Date('2026-01-31'));
  });

  it('paginates results and caps an oversized page size', async () => {
    prisma.accessLog.findMany.mockResolvedValue([]);
    prisma.accessLog.count.mockResolvedValue(250);

    const result = await service.findAll({ page: 2, pageSize: 500 });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- untyped jest.fn() mock
    const args = prisma.accessLog.findMany.mock.calls[0][0] as FindManyArgs;
    expect(args.take).toBe(100);
    expect(args.skip).toBe(100);
    expect(result.total).toBe(250);
  });

  it('applies a default page size when none is given', async () => {
    prisma.accessLog.findMany.mockResolvedValue([]);
    prisma.accessLog.count.mockResolvedValue(0);

    await service.findAll({});

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- untyped jest.fn() mock
    const args = prisma.accessLog.findMany.mock.calls[0][0] as FindManyArgs;
    expect(args.take).toBe(25);
    expect(args.skip).toBe(0);
  });

  it('throws NotFoundException for a missing log', async () => {
    prisma.accessLog.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
