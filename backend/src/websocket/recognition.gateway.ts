import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface RecognitionDetectedPayload {
  memberId: string;
  name: string;
  confidence: number;
  timestamp: string;
  action: 'AUTO_OPENED' | 'MANUAL_OPENED' | 'DENIED';
}

export interface UnknownFaceDetectedPayload {
  confidence: number;
  timestamp: string;
  snapshotPath: string | null;
}

export interface GateStatusPayload {
  status: 'LOCKED' | 'JUST_OPENED' | 'MANUAL_OVERRIDE';
  trigger: 'AUTO' | 'MANUAL';
  timestamp: string;
}

export interface SystemStatusPayload {
  service: 'postgres' | 'redis' | 'recognition_service';
  status: 'up' | 'down';
  timestamp: string;
}

/**
 * Pushes live events to connected dashboards (README Section 2.2 / Section 5
 * WebSocket contract). Emit-only from the server's perspective - the
 * dashboard doesn't send commands over this socket, it uses the REST API.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class RecognitionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RecognitionGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * REST endpoints are protected by JwtAuthGuard globally (see AuthModule);
   * a WebSocket handshake never goes through that guard, so authentication
   * has to be checked here instead (README Section 20 Rule 5 - never skip
   * auth just because it's a different transport). Clients connect with
   * `io(url, { auth: { token } })`.
   */
  handleConnection(client: Socket) {
    const auth = client.handshake.auth as Record<string, unknown>;
    const query = client.handshake.query as Record<string, unknown>;
    const token: unknown = auth.token ?? query.token;
    if (!token || typeof token !== 'string') {
      this.logger.warn(
        `Rejected WebSocket connection ${client.id}: no auth token`,
      );
      client.disconnect(true);
      return;
    }
    try {
      this.jwtService.verify(token);
    } catch {
      this.logger.warn(
        `Rejected WebSocket connection ${client.id}: invalid token`,
      );
      client.disconnect(true);
      return;
    }
    this.logger.log(`Dashboard client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Dashboard client disconnected: ${client.id}`);
  }

  emitRecognitionDetected(payload: RecognitionDetectedPayload) {
    this.server.emit('recognition.detected', payload);
  }

  emitUnknownFaceDetected(payload: UnknownFaceDetectedPayload) {
    this.server.emit('unknown-face.detected', payload);
  }

  emitGateStatus(payload: GateStatusPayload) {
    this.server.emit('gate.status', payload);
  }

  emitSystemStatus(payload: SystemStatusPayload) {
    this.server.emit('system.status', payload);
  }
}
