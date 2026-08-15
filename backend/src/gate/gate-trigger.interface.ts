export const GATE_TRIGGER = Symbol('GATE_TRIGGER');

export interface GateTriggerResult {
  firedAt: Date;
}

/**
 * Hardware abstraction (README Section 20 Rule 3). Phase 1 registers only
 * SimulatedGateTrigger. Phase 3 adds a RelayGateTrigger/Esp32GateTrigger
 * implementing this same interface - GateService, GateController, and the
 * REST/WebSocket contracts do not change when that happens.
 */
export interface GateTrigger {
  trigger(): Promise<GateTriggerResult>;
}
