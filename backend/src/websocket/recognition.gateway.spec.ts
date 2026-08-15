import { RecognitionGateway } from './recognition.gateway';

describe('RecognitionGateway', () => {
  let gateway: RecognitionGateway;
  const server = { emit: jest.fn() };
  const jwtService = { verify: jest.fn() };

  beforeEach(() => {
    gateway = new RecognitionGateway(jwtService as never);
    gateway.server = server as never;
    jest.clearAllMocks();
  });

  it('emits recognition.detected', () => {
    const payload = {
      memberId: '1',
      name: 'Ali',
      confidence: 0.9,
      timestamp: 't',
      action: 'AUTO_OPENED' as const,
    };

    gateway.emitRecognitionDetected(payload);

    expect(server.emit).toHaveBeenCalledWith('recognition.detected', payload);
  });

  it('emits unknown-face.detected', () => {
    const payload = { confidence: 0.3, timestamp: 't', snapshotPath: null };

    gateway.emitUnknownFaceDetected(payload);

    expect(server.emit).toHaveBeenCalledWith('unknown-face.detected', payload);
  });

  it('emits gate.status', () => {
    const payload = {
      status: 'JUST_OPENED' as const,
      trigger: 'MANUAL' as const,
      timestamp: 't',
    };

    gateway.emitGateStatus(payload);

    expect(server.emit).toHaveBeenCalledWith('gate.status', payload);
  });

  it('emits system.status', () => {
    const payload = {
      service: 'redis' as const,
      status: 'up' as const,
      timestamp: 't',
    };

    gateway.emitSystemStatus(payload);

    expect(server.emit).toHaveBeenCalledWith('system.status', payload);
  });

  describe('handleConnection', () => {
    const makeClient = (auth: Record<string, unknown> = {}) => ({
      id: 'client-1',
      handshake: { auth, query: {} },
      disconnect: jest.fn(),
    });

    it('disconnects a client with no auth token', () => {
      const client = makeClient();

      gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects a client with an invalid/expired token', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });
      const client = makeClient({ token: 'bad-token' });

      gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('accepts a client with a valid token', () => {
      jwtService.verify.mockReturnValue({ username: 'admin' });
      const client = makeClient({ token: 'good-token' });

      gateway.handleConnection(client as never);

      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });
});
