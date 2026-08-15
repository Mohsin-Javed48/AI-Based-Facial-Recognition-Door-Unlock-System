import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AccessLogsService } from '../access-logs/access-logs.service';
import { GateService } from '../gate/gate.service';
import { MembersService } from '../members/members.service';
import { RecognitionGateway } from '../websocket/recognition.gateway';
import {
  RecognitionEventDto,
  RecognitionEventType,
} from './dto/recognition-event.dto';

/**
 * Orchestrates a recognition event once it's off Redis (README Section 7).
 * The Python service remains solely responsible for the recognition
 * decision itself (detect/embed/match/threshold) - this class never
 * re-evaluates confidence against a threshold, it only routes the decision
 * Python already made.
 *
 * De-duplication of rapid repeat events for the same person is handled
 * upstream, by the Python service's own gate cooldown
 * (recognition/app/gate_trigger.py) before it ever publishes - this class
 * processes every event it receives independently rather than maintaining a
 * second, potentially-drifting cooldown window here.
 */
@Injectable()
export class AccessEventsService {
  private readonly logger = new Logger(AccessEventsService.name);

  constructor(
    private readonly membersService: MembersService,
    private readonly accessLogsService: AccessLogsService,
    private readonly gateService: GateService,
    private readonly gateway: RecognitionGateway,
  ) {}

  /**
   * Validates a raw payload (e.g. JSON parsed off Redis) before processing.
   * Returns false instead of throwing for malformed input, so one bad
   * message never crashes the subscriber loop.
   */
  async handleRawEvent(raw: unknown): Promise<boolean> {
    const event = plainToInstance(RecognitionEventDto, raw);
    const errors = await validate(event);
    if (errors.length > 0) {
      this.logger.warn(
        `Discarding invalid recognition event: ${JSON.stringify(raw)}`,
      );
      return false;
    }
    await this.process(event);
    return true;
  }

  async process(event: RecognitionEventDto): Promise<void> {
    if (event.eventType === RecognitionEventType.FACE_RECOGNIZED) {
      await this.handleRecognized(event);
    } else {
      await this.handleUnknown(event);
    }
  }

  private async handleRecognized(event: RecognitionEventDto): Promise<void> {
    const member = event.name
      ? await this.membersService.findByName(event.name)
      : null;

    if (!member || !member.isActive) {
      this.logger.warn(
        `Recognized name "${event.name}" has no matching active member - denying access.`,
      );
      await this.accessLogsService.create({
        timestamp: new Date(event.timestamp),
        memberId: member?.id ?? null,
        matchedName: event.name ?? null,
        confidence: event.confidence,
        snapshotPath: event.snapshotPath ?? null,
        action: 'DENIED',
        eventType: 'FACE_RECOGNIZED',
      });
      this.gateway.emitRecognitionDetected({
        memberId: member?.id ?? '',
        name: event.name ?? 'Unknown',
        confidence: event.confidence,
        timestamp: event.timestamp,
        action: 'DENIED',
      });
      return;
    }

    await this.accessLogsService.create({
      timestamp: new Date(event.timestamp),
      memberId: member.id,
      matchedName: member.name,
      confidence: event.confidence,
      snapshotPath: event.snapshotPath ?? null,
      action: 'AUTO_OPENED',
      eventType: 'FACE_RECOGNIZED',
    });

    await this.gateService.fireSimulated();

    this.gateway.emitRecognitionDetected({
      memberId: member.id,
      name: member.name,
      confidence: event.confidence,
      timestamp: event.timestamp,
      action: 'AUTO_OPENED',
    });
  }

  private async handleUnknown(event: RecognitionEventDto): Promise<void> {
    await this.accessLogsService.create({
      timestamp: new Date(event.timestamp),
      memberId: null,
      matchedName: null,
      confidence: event.confidence,
      snapshotPath: event.snapshotPath ?? null,
      action: 'DENIED',
      eventType: 'FACE_UNKNOWN',
    });

    this.gateway.emitUnknownFaceDetected({
      confidence: event.confidence,
      timestamp: event.timestamp,
      snapshotPath: event.snapshotPath ?? null,
    });
  }
}
