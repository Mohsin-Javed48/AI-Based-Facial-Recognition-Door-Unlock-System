import { Inject, Injectable } from '@nestjs/common';
import { AccessLogsService } from '../access-logs/access-logs.service';
import { RecognitionGateway } from '../websocket/recognition.gateway';
import { GATE_TRIGGER, type GateTrigger } from './gate-trigger.interface';

@Injectable()
export class GateService {
  constructor(
    @Inject(GATE_TRIGGER) private readonly gateTrigger: GateTrigger,
    private readonly accessLogsService: AccessLogsService,
    private readonly gateway: RecognitionGateway,
  ) {}

  /** POST /gate/trigger - dashboard "Manual Unlock" button (Section 9). */
  async triggerManual() {
    const { firedAt } = await this.gateTrigger.trigger();

    const log = await this.accessLogsService.create({
      timestamp: firedAt,
      memberId: null,
      matchedName: null,
      confidence: null,
      snapshotPath: null,
      action: 'MANUAL_OPENED',
      eventType: 'MANUAL',
    });

    this.gateway.emitGateStatus({
      status: 'JUST_OPENED',
      trigger: 'MANUAL',
      timestamp: firedAt.toISOString(),
    });

    return log;
  }

  /**
   * Called by AccessEventsService for a recognized + active member
   * (Section 7). Does not create its own access log - the caller already
   * owns that, since it has the full recognition context (member, snapshot).
   */
  async fireSimulated(): Promise<Date> {
    const { firedAt } = await this.gateTrigger.trigger();

    this.gateway.emitGateStatus({
      status: 'JUST_OPENED',
      trigger: 'AUTO',
      timestamp: firedAt.toISOString(),
    });

    return firedAt;
  }
}
