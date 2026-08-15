import { Test } from '@nestjs/testing';
import { AccessLogsService } from '../access-logs/access-logs.service';
import { RecognitionGateway } from '../websocket/recognition.gateway';
import { GATE_TRIGGER } from './gate-trigger.interface';
import { GateService } from './gate.service';

describe('GateService', () => {
  let service: GateService;
  const gateTrigger = { trigger: jest.fn() };
  const accessLogsService = { create: jest.fn() };
  const gateway = { emitGateStatus: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        GateService,
        { provide: GATE_TRIGGER, useValue: gateTrigger },
        { provide: AccessLogsService, useValue: accessLogsService },
        { provide: RecognitionGateway, useValue: gateway },
      ],
    }).compile();
    service = moduleRef.get(GateService);
  });

  it('fires a manual trigger, logs it as MANUAL_OPENED, and emits gate status', async () => {
    const firedAt = new Date('2026-01-01T00:00:00Z');
    gateTrigger.trigger.mockResolvedValue({ firedAt });
    accessLogsService.create.mockResolvedValue({
      id: 'log1',
      action: 'MANUAL_OPENED',
    });

    const result = await service.triggerManual();

    expect(gateTrigger.trigger).toHaveBeenCalled();
    expect(accessLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MANUAL_OPENED',
        eventType: 'MANUAL',
        confidence: null,
        memberId: null,
      }),
    );
    expect(gateway.emitGateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'MANUAL', status: 'JUST_OPENED' }),
    );
    expect(result.id).toBe('log1');
  });

  it('fires the simulated trigger for automatic recognition without creating its own log', async () => {
    const firedAt = new Date('2026-01-01T00:00:00Z');
    gateTrigger.trigger.mockResolvedValue({ firedAt });

    const result = await service.fireSimulated();

    expect(accessLogsService.create).not.toHaveBeenCalled();
    expect(gateway.emitGateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'AUTO', status: 'JUST_OPENED' }),
    );
    expect(result).toEqual(firedAt);
  });
});
