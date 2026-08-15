'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';
import { SnapshotImage } from '@/components/SnapshotImage';

const PAGE_SIZE = 20;

function actionBadgeClass(action: string): string {
  if (action === 'AUTO_OPENED' || action === 'MANUAL_OPENED') return 'bg-emerald-950 text-emerald-400';
  if (action === 'DENIED') return 'bg-red-950 text-red-400';
  return 'bg-slate-800 text-slate-400';
}

export default function AccessLogPage() {
  const { token, logout } = useAuth();
  const live = useLiveEvents();
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [memberId, setMemberId] = useState('');
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);

  const queryKey = token
    ? ['access-logs', token, page, dateFrom, dateTo, memberId]
    : null;

  const { data, error, mutate } = useSWR(queryKey, () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (memberId) params.set('memberId', memberId);
    return api.getAccessLogs(token as string, params);
  });

  const { data: members } = useSWR(token ? ['members', token] : null, () => api.getMembers(token as string));

  // Live-tail: revalidate when a new event arrives, but only while viewing
  // an unfiltered page 1, so a live event never yanks someone out of a
  // historical/filtered view they're looking at. `mutate` is SWR's own
  // cache-revalidation trigger, not a local setState call, so this effect
  // doesn't fall under the "no setState in effects" rule.
  useEffect(() => {
    if (page === 1 && !dateFrom && !dateTo && !memberId) {
      mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.lastRecognition, live.lastUnknown]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (error instanceof ApiError && error.status === 401) {
    return (
      <div className="rounded-md border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
        Session expired.{' '}
        <button onClick={logout} className="underline">
          Log in again
        </button>
        .
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-100">Access Log</h2>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Person
          <select
            value={memberId}
            onChange={(e) => {
              setMemberId(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="">All</option>
            {(members ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {(dateFrom || dateTo || memberId) && (
          <button
            onClick={() => {
              setDateFrom('');
              setDateTo('');
              setMemberId('');
              setPage(1);
            }}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Snapshot</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Event</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((log) => (
              <tr key={log.id} className="border-b border-slate-800/60 last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-200">{log.matchedName ?? 'Unknown'}</td>
                <td className="px-4 py-3 text-slate-300">
                  {log.confidence != null ? `${Math.round(log.confidence * 100)}%` : '—'}
                </td>
                <td className="px-4 py-3">
                  {log.snapshotPath ? (
                    <button
                      onClick={() => setExpandedSnapshot(log.snapshotPath)}
                      className="block h-10 w-14 overflow-hidden rounded"
                    >
                      <SnapshotImage filename={log.snapshotPath} alt="Snapshot" className="h-10 w-14 object-cover" />
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${actionBadgeClass(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">{log.eventType}</td>
              </tr>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No access log entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{data ? `${data.total} total` : ''}</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-slate-700 px-3 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-700 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {expandedSnapshot && (
        <div
          onClick={() => setExpandedSnapshot(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
        >
          <SnapshotImage filename={expandedSnapshot} alt="Snapshot preview" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
