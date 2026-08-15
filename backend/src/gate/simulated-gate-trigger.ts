import { Injectable, Logger } from '@nestjs/common';
import { GateTrigger, GateTriggerResult } from './gate-trigger.interface';

/**
 * Phase 1: never touches hardware. Mirrors the Python recognition service's
 * own Phase 0 stub (recognition/app/gate_trigger.py) - logs the action and
 * nothing else. Phase 3 swaps this class for a real relay/ESP32 trigger.
 */
@Injectable()
export class SimulatedGateTrigger implements GateTrigger {
  private readonly logger = new Logger(SimulatedGateTrigger.name);

  trigger(): Promise<GateTriggerResult> {
    const firedAt = new Date();
    this.logger.log(`GATE WOULD OPEN (simulated) at ${firedAt.toISOString()}`);
    // No `await` here on purpose - Phase 1 has nothing to wait on. Kept as a
    // Promise (not `async`, to avoid the require-await lint rule) because
    // Phase 3's real relay/ESP32 implementation genuinely will be async.
    return Promise.resolve({ firedAt });
  }
}
