import { Test } from '@nestjs/testing';
import { AccessLogsService } from '../access-logs/access-logs.service';
import { GateService } from '../gate/gate.service';
import { MembersService } from '../members/members.service';
import { RecognitionGateway } from '../websocket/recognition.gateway';
import { AccessEventsService } from './access-events.service';
import { RecognitionEventType } from './dto/recognition-event.dto';

describe('AccessEventsService', () => {
  let service: AccessEventsService;
  const membersService = { findByName: jest.fn() };
  const accessLogsService = { create: jest.fn() };
  const gateService = { fireSimulated: jest.fn() };
  const gateway = {
    emitRecognitionDetected: jest.fn(),
    emitUnknownFaceDetected: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccessEventsService,
        { provide: MembersService, useValue: membersService },
        { provide: AccessLogsService, useValue: accessLogsService },
        { provide: GateService, useValue: gateService },
        { provide: RecognitionGateway, useValue: gateway },
      ],
    }).compile();
    service = moduleRef.get(AccessEventsService);
  });

  const recognizedEvent = {
    eventType: RecognitionEventType.FACE_RECOGNIZED,
    name: 'Ali',
    confidence: 0.91,
    snapshotPath: '/snapshots/1.jpg',
    timestamp: '2026-01-01T00:00:00.000Z',
  };

  it('processes a valid recognized event for an active member: logs, fires the gate, emits WS', async () => {
    membersService.findByName.mockResolvedValue({
      id: 'm1',
      name: 'Ali',
      isActive: true,
    });
    gateService.fireSimulated.mockResolvedValue(new Date());

    await service.process(recognizedEvent);

    expect(accessLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: 'm1',
        action: 'AUTO_OPENED',
        eventType: 'FACE_RECOGNIZED',
      }),
    );
    expect(gateService.fireSimulated).toHaveBeenCalled();
    expect(gateway.emitRecognitionDetected).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'm1', action: 'AUTO_OPENED' }),
    );
  });

  it('denies and does not trigger the gate for an inactive member', async () => {
    membersService.findByName.mockResolvedValue({
      id: 'm1',
      name: 'Ali',
      isActive: false,
    });

    await service.process(recognizedEvent);

    expect(accessLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DENIED',
        eventType: 'FACE_RECOGNIZED',
      }),
    );
    expect(gateService.fireSimulated).not.toHaveBeenCalled();
    expect(gateway.emitRecognitionDetected).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DENIED' }),
    );
  });

  it('denies and does not trigger the gate when the recognized name has no matching member', async () => {
    membersService.findByName.mockResolvedValue(null);

    await service.process(recognizedEvent);

    expect(accessLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DENIED', memberId: null }),
    );
    expect(gateService.fireSimulated).not.toHaveBeenCalled();
  });

  it('processes an unknown-face event: logs, never triggers the gate, emits unknown-face WS event', async () => {
    const unknownEvent = {
      eventType: RecognitionEventType.FACE_UNKNOWN,
      name: null,
      confidence: 0.32,
      snapshotPath: null,
      timestamp: '2026-01-01T00:00:00.000Z',
    };

    await service.process(unknownEvent);

    expect(accessLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DENIED',
        eventType: 'FACE_UNKNOWN',
        memberId: null,
      }),
    );
    expect(gateService.fireSimulated).not.toHaveBeenCalled();
    expect(gateway.emitUnknownFaceDetected).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 0.32 }),
    );
  });

  it('discards an invalid/malformed raw event without processing it', async () => {
    const result = await service.handleRawEvent({
      eventType: 'NOT_A_REAL_TYPE',
    });

    expect(result).toBe(false);
    expect(accessLogsService.create).not.toHaveBeenCalled();
  });

  it('processes a valid raw event end to end via handleRawEvent', async () => {
    membersService.findByName.mockResolvedValue({
      id: 'm1',
      name: 'Ali',
      isActive: true,
    });
    gateService.fireSimulated.mockResolvedValue(new Date());

    const result = await service.handleRawEvent(recognizedEvent);

    expect(result).toBe(true);
    expect(accessLogsService.create).toHaveBeenCalled();
  });
});
