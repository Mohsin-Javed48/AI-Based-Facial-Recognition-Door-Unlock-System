import type { AccessLog, AccessLogPage, HealthReport, Member } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ accessToken: string }>('/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getHealth: () => request<HealthReport>('/health', null),

  getMembers: (token: string) => request<Member[]>('/members', token),

  createMember: (token: string, data: { name: string; profilePhoto?: string }) =>
    request<Member>('/members', token, { method: 'POST', body: JSON.stringify(data) }),

  setMemberStatus: (token: string, id: string, isActive: boolean) =>
    request<Member>(`/members/${id}/status`, token, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  deleteMember: (token: string, id: string) =>
    request<void>(`/members/${id}`, token, { method: 'DELETE' }),

  getAccessLogs: (token: string, params: URLSearchParams) =>
    request<AccessLogPage>(`/access-logs?${params.toString()}`, token),

  triggerGate: (token: string) => request<AccessLog>('/gate/trigger', token, { method: 'POST' }),

  snapshotUrl: (filename: string) => `${API_URL}/snapshots/${filename}`,
};
