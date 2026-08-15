import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum RecognitionEventType {
  FACE_RECOGNIZED = 'FACE_RECOGNIZED',
  FACE_UNKNOWN = 'FACE_UNKNOWN',
}

/**
 * Shape published by the Python recognition service on the
 * `gate:recognition-events` Redis channel (docs/phase1.md Redis contract).
 * There is no memberId here on purpose - Phase 0 only knows enrollment
 * names, never Postgres IDs. AccessEventsService resolves memberId
 * server-side by name.
 */
export class RecognitionEventDto {
  @IsEnum(RecognitionEventType)
  eventType: RecognitionEventType;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsOptional()
  @IsString()
  snapshotPath?: string | null;

  @IsISO8601()
  timestamp: string;
}
