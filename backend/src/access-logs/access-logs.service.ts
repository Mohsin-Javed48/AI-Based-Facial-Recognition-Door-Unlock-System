import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessEventType, GateAction, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { QueryAccessLogsDto } from './dto/query-access-logs.dto';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface CreateAccessLogInput {
  timestamp: Date;
  memberId: string | null;
  matchedName: string | null;
  confidence: number | null;
  snapshotPath: string | null;
  action: GateAction;
  eventType: AccessEventType;
}

@Injectable()
export class AccessLogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAccessLogInput) {
    return this.prisma.accessLog.create({ data: input });
  }

  async findAll(query: QueryAccessLogsDto) {
    const page = query.page ?? 1;
    // Never load an unlimited number of logs into the dashboard (Section 5).
    const pageSize = Math.min(
      query.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    const where: Prisma.AccessLogWhereInput = {};
    if (query.memberId) where.memberId = query.memberId;
    if (query.eventType) where.eventType = query.eventType;
    if (query.dateFrom || query.dateTo) {
      where.timestamp = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.accessLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.accessLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const log = await this.prisma.accessLog.findUnique({ where: { id } });
    if (!log) {
      throw new NotFoundException(`Access log ${id} not found`);
    }
    return log;
  }
}
