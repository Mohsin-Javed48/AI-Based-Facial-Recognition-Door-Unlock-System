'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';
import { SnapshotImage } from '@/components/SnapshotImage';

const HEALTH_POLL_MS = 10_000;
const GATE_AUTO_RELOCK_MS = 10_000;
const UNKNOWN_ALERT_WINDOW_MS = 30_000;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function StatusDot({ status }: { status: 'up' | 'down' | 'unknown' }) {
  const color = status === 'up' ? 'bg-emerald-500' : status === 'down' ? 'bg-red-500' : 'bg-slate-500';
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export default function LiveStatusPage() {
  const { token, logout } = useAuth();
  const live = useLiveEvents();

  // /health isn't pushed over the WebSocket (README Section 15) - poll it.
  const { data: health } = useSWR('health', () => api.getHealth(), {
    refreshInterval: HEALTH_POLL_MS,
    // A network failure here means the backend itself is unreachable - keep
    // showing the last-known report rather than clearing it to a blank state.
    shouldRetryOnError: true,
  });

  // recognition.detected has no snapshotPath (see
  // backend/src/websocket/recognition.gateway.ts) - refetch the freshest
  // access-log row for the snapshot preview instead of trying to carry it
  // through the WS payload. `mutate` is SWR's own revalidation trigger, not
  // a local setState, so the effect below isn't a "setState in effect" case.
  //
  // Two separate queries, not one: the overall latest event (any type)
  // drives the snapshot + "last event time" (a stranger walking up is still
  // "what the camera just saw"), while "Last recognized" / "Confidence"
  // should keep showing the last person who *was* recognized rather than
  // reverting to "None yet" the moment an unrelated unknown-face event
  // becomes the newest row.
  const { data: latestLogPage, mutate: refetchLatestLog } = useSWR(
    token ? ['latest-log', token] : null,
    () => api.getAccessLogs(token as string, new URLSearchParams({ pageSize: '1' })),
  );
  const latestLog = latestLogPage?.items[0] ?? null;

  const { data: latestRecognizedPage, mutate: refetchLatestRecognized } = useSWR(
    token ? ['latest-recognized-log', token] : null,
    () =>
      api.getAccessLogs(
        token as string,
        new URLSearchParams({ pageSize: '1', eventType: 'FACE_RECOGNIZED' }),
      ),
  );
  const latestRecognizedLog = latestRecognizedPage?.items[0] ?? null;

  useEffect(() => {
    refetchLatestLog();
    refetchLatestRecognized();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.lastRecognition, live.lastUnknown]);

  // The gate has no persistent "locked/open" state to poll - it's a
  // momentary simulated pulse (README Flow.png: gate closes automatically
  // after a configured time). This is genuinely timer-driven ephemeral UI,
  // not state derived from props, and `Date.now()` is disallowed during
  // render (react-hooks/purity) - an effect + setTimeout is the only
  // compliant way to show, then auto-clear, this value.
  const [gateDisplayStatus, setGateDisplayStatus] = useState<'LOCKED' | 'JUST_OPENED'>('LOCKED');
  useEffect(() => {
    if (live.gateStatus?.status !== 'JUST_OPENED') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGateDisplayStatus('JUST_OPENED');
    const timer = setTimeout(() => setGateDisplayStatus('LOCKED'), GATE_AUTO_RELOCK_MS);
    return () => clearTimeout(timer);
  }, [live.gateStatus]);

  // Same reasoning as gateDisplayStatus above.
  const [showUnknownAlert, setShowUnknownAlert] = useState(false);
  useEffect(() => {
    if (!live.lastUnknown) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowUnknownAlert(true);
    const timer = setTimeout(() => setShowUnknownAlert(false), UNKNOWN_ALERT_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [live.lastUnknown]);

  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleManualUnlock() {
    if (!token) return;
    if (!window.confirm('Manually unlock the gate?')) return;
    setTriggering(true);
    setError(null);
    try {
      await api.triggerGate(token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Failed to trigger the gate');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-1">
          <h2 className="mb-3 text-sm font-medium text-slate-400">Current Camera Snapshot</h2>
          {latestLog?.snapshotPath ? (
            <SnapshotImage
              filename={latestLog.snapshotPath}
              alt="Latest camera snapshot"
              className="aspect-video w-full rounded-lg object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-slate-800 text-sm text-slate-500">
              No snapshot yet
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium text-slate-400">Live Status</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-slate-500">Gate status</div>
              <div
                className={`mt-1 text-lg font-semibold ${
                  gateDisplayStatus === 'JUST_OPENED' ? 'text-emerald-400' : 'text-slate-200'
                }`}
              >
                {gateDisplayStatus === 'JUST_OPENED' ? 'Just Opened' : 'Locked'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Last recognized</div>
              <div className="mt-1 text-lg font-semibold text-slate-200">
                {latestRecognizedLog?.matchedName ?? 'None yet'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Confidence</div>
              <div className="mt-1 text-lg font-semibold text-slate-200">
                {latestRecognizedLog?.confidence != null
                  ? `${Math.round(latestRecognizedLog.confidence * 100)}%`
                  : '—'}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <div className="text-xs text-slate-500">Last event time</div>
              <div className="mt-1 text-sm text-slate-300">
                {latestLog ? `${timeAgo(latestLog.timestamp)} (${latestLog.action})` : '—'}
              </div>
            </div>
          </div>

          <button
            onClick={handleManualUnlock}
            disabled={triggering}
            className="mt-5 w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
          >
            {triggering ? 'Opening...' : 'Manual Unlock'}
          </button>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-400">Alerts & System Health</h2>
        <div className="space-y-2">
          {showUnknownAlert && live.lastUnknown && (
            <div className="rounded-md border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
              Unknown face detected at gate ({Math.round(live.lastUnknown.confidence * 100)}% confidence),{' '}
              {timeAgo(live.lastUnknown.timestamp)}.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <StatusDot status={health ? 'up' : 'down'} />
              Backend
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <StatusDot status={health?.checks.postgres.status ?? 'unknown'} />
              Database
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <StatusDot status={health?.checks.redis.status ?? 'unknown'} />
              Redis
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <StatusDot status={health?.checks.recognitionService.status ?? 'unknown'} />
              Recognition service
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <StatusDot status={live.connected ? 'up' : 'down'} />
              Live updates
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
