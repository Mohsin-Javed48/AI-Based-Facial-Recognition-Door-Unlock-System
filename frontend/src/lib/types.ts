export interface Member {
  id: string;
  name: string;
  profilePhoto: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AccessEventType = 'FACE_RECOGNIZED' | 'FACE_UNKNOWN' | 'MANUAL';
export type GateAction = 'AUTO_OPENED' | 'MANUAL_OPENED' | 'DENIED' | 'NONE';

export interface AccessLog {
  id: string;
  timestamp: string;
  memberId: string | null;
  matchedName: string | null;
  confidence: number | null;
  snapshotPath: string | null;
  action: GateAction;
  eventType: AccessEventType;
  createdAt: string;
}

export interface AccessLogPage {
  items: AccessLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HealthCheck {
  status: 'up' | 'down' | 'unknown';
  message?: string;
  lastEventSecondsAgo?: number;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  checks: {
    postgres: HealthCheck;
    redis: HealthCheck;
    recognitionService: HealthCheck;
  };
  timestamp: string;
}

export interface RecognitionDetected {
  memberId: string;
  name: string;
  confidence: number;
  timestamp: string;
  action: 'AUTO_OPENED' | 'MANUAL_OPENED' | 'DENIED';
}

export interface UnknownFaceDetected {
  confidence: number;
  timestamp: string;
  snapshotPath: string | null;
}

export interface GateStatusEvent {
  status: 'LOCKED' | 'JUST_OPENED' | 'MANUAL_OVERRIDE';
  trigger: 'AUTO' | 'MANUAL';
  timestamp: string;
}
