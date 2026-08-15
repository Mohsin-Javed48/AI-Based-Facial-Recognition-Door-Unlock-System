import { Test } from '@nestjs/testing';
import { AccessEventsService } from '../access-events/access-events.service';
import { RedisSubscriberService } from './redis-subscriber.service';
import { REDIS_SUBSCRIBER_CLIENT } from './redis.constants';

describe('RedisSubscriberService', () => {
  let service: RedisSubscriberService;
  const subscriber = {
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    on: jest.fn(),
  };
  const accessEventsService = { handleRawEvent: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RedisSubscriberService,
        { provide: REDIS_SUBSCRIBER_CLIENT, useValue: subscriber },
        { provide: AccessEventsService, useValue: accessEventsService },
      ],
    }).compile();
    service = moduleRef.get(RedisSubscriberService);
  });

  it('subscribes to the configured channel and registers a message listener on init', async () => {
    await service.onModuleInit();

    expect(subscriber.subscribe).toHaveBeenCalledWith(
      'gate:recognition-events',
    );
    expect(subscriber.on).toHaveBeenCalledWith('message', expect.any(Function));
  });

  describe('onMessage', () => {
    it('forwards messages on the configured channel to handleMessage', () => {
      const handleMessageSpy = jest
        .spyOn(service, 'handleMessage')
        .mockResolvedValue(undefined);

      service.onMessage('gate:recognition-events', '{}');

      expect(handleMessageSpy).toHaveBeenCalledWith('{}');
    });

    it('ignores messages published on a different channel', () => {
      const handleMessageSpy = jest.spyOn(service, 'handleMessage');

      service.onMessage('some-other-channel', '{}');

      expect(handleMessageSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleMessage', () => {
    it('parses and forwards a valid JSON message to AccessEventsService', async () => {
      const payload = {
        eventType: 'FACE_RECOGNIZED',
        name: 'Ali',
        confidence: 0.9,
        timestamp: '2026-01-01T00:00:00.000Z',
      };

      await service.handleMessage(JSON.stringify(payload));

      expect(accessEventsService.handleRawEvent).toHaveBeenCalledWith(payload);
    });

    it('discards a non-JSON message without throwing', async () => {
      await expect(service.handleMessage('not json')).resolves.toBeUndefined();

      expect(accessEventsService.handleRawEvent).not.toHaveBeenCalled();
    });
  });

  describe('getLastMessageAt', () => {
    it('is null before any message has been received', () => {
      expect(service.getLastMessageAt()).toBeNull();
    });

    it('is set after a valid message is processed', async () => {
      const payload = {
        eventType: 'FACE_UNKNOWN',
        confidence: 0.2,
        timestamp: '2026-01-01T00:00:00.000Z',
      };

      await service.handleMessage(JSON.stringify(payload));

      expect(service.getLastMessageAt()).toBeInstanceOf(Date);
    });
  });

  it('unsubscribes and disconnects on destroy', async () => {
    await service.onModuleDestroy();

    expect(subscriber.unsubscribe).toHaveBeenCalledWith(
      'gate:recognition-events',
    );
    expect(subscriber.disconnect).toHaveBeenCalled();
  });
});
