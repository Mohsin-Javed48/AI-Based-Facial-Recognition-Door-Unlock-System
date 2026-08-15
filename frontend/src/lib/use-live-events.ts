'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './auth';
import type { GateStatusEvent, RecognitionDetected, UnknownFaceDetected } from './types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
const MAX_RECENT_EVENTS = 20;

export type LiveEvent =
  | { kind: 'recognition'; data: RecognitionDetected }
  | { kind: 'unknown'; data: UnknownFaceDetected };

interface LiveState {
  connected: boolean;
  gateStatus: GateStatusEvent | null;
  lastRecognition: RecognitionDetected | null;
  lastUnknown: UnknownFaceDetected | null;
  recentEvents: LiveEvent[];
}

const initialState: LiveState = {
  connected: false,
  gateStatus: null,
  lastRecognition: null,
  lastUnknown: null,
  recentEvents: [],
};

/** Live dashboard state driven by the backend's WebSocket gateway
 * (README Section 8 / Section 10.1). */
export function useLiveEvents(): LiveState {
  const { token } = useAuth();
  const [state, setState] = useState<LiveState>(initialState);

  useEffect(() => {
    if (!token) return;
    const socket = io(WS_URL, { auth: { token } });

    socket.on('connect', () => setState((s) => ({ ...s, connected: true })));
    socket.on('disconnect', () => setState((s) => ({ ...s, connected: false })));

    socket.on('recognition.detected', (data: RecognitionDetected) => {
      const event: LiveEvent = { kind: 'recognition', data };
      setState((s) => ({
        ...s,
        lastRecognition: data,
        recentEvents: [event, ...s.recentEvents].slice(0, MAX_RECENT_EVENTS),
      }));
    });

    socket.on('unknown-face.detected', (data: UnknownFaceDetected) => {
      const event: LiveEvent = { kind: 'unknown', data };
      setState((s) => ({
        ...s,
        lastUnknown: data,
        recentEvents: [event, ...s.recentEvents].slice(0, MAX_RECENT_EVENTS),
      }));
    });

    socket.on('gate.status', (data: GateStatusEvent) => {
      setState((s) => ({ ...s, gateStatus: data }));
    });

    return () => {
      socket.close();
    };
  }, [token]);

  return state;
}
