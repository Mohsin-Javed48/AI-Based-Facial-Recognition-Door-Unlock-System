import { Module } from '@nestjs/common';
import { AccessLogsModule } from '../access-logs/access-logs.module';
import { GateModule } from '../gate/gate.module';
import { MembersModule } from '../members/members.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { AccessEventsService } from './access-events.service';

@Module({
  imports: [MembersModule, AccessLogsModule, GateModule, WebsocketModule],
  providers: [AccessEventsService],
  exports: [AccessEventsService],
})
export class AccessEventsModule {}
