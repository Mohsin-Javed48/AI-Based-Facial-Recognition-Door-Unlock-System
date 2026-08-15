import { Module } from '@nestjs/common';
import { AccessLogsModule } from '../access-logs/access-logs.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { GateController } from './gate.controller';
import { GATE_TRIGGER } from './gate-trigger.interface';
import { GateService } from './gate.service';
import { SimulatedGateTrigger } from './simulated-gate-trigger';

@Module({
  imports: [AccessLogsModule, WebsocketModule],
  controllers: [GateController],
  providers: [
    GateService,
    { provide: GATE_TRIGGER, useClass: SimulatedGateTrigger },
  ],
  exports: [GateService],
})
export class GateModule {}
