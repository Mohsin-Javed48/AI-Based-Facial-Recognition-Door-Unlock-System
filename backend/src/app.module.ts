import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { MembersModule } from './members/members.module';
import { AccessLogsModule } from './access-logs/access-logs.module';
import { WebsocketModule } from './websocket/websocket.module';
import { GateModule } from './gate/gate.module';
import { AccessEventsModule } from './access-events/access-events.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { SnapshotsModule } from './snapshots/snapshots.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MembersModule,
    AccessLogsModule,
    WebsocketModule,
    GateModule,
    AccessEventsModule,
    RedisModule,
    HealthModule,
    SnapshotsModule,
  ],
})
export class AppModule {}
