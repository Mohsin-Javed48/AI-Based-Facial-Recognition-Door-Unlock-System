'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import type { Member } from '@/lib/types';

export default function MembersPage() {
  const { token, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<Member | null>(null);

  const {
    data: members,
    error: loadError,
    mutate,
  } = useSWR<Member[]>(token ? ['members', token] : null, () => api.getMembers(token as string));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const member = await api.createMember(token, { name: newName.trim() });
      setNewName('');
      setJustAdded(member);
      await mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add member');
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleActive(member: Member) {
    if (!token) return;
    try {
      await api.setMemberStatus(token, member.id, !member.isActive);
      await mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update member');
    }
  }

  async function handleDelete(member: Member) {
    if (!token) return;
    if (!window.confirm(`Remove ${member.name}? This cannot be undone.`)) return;
    try {
      await api.deleteMember(token, member.id);
      await mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete member');
    }
  }

  if (loadError instanceof ApiError && loadError.status === 401) {
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
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-100">Family Members</h2>

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
      >
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Add member
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (matches the enrollment folder name)"
            className="w-72 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Add Member'}
        </button>
      </form>

      {justAdded && (
        <div className="rounded-md border border-emerald-700/50 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          <p className="font-medium">
            &quot;{justAdded.name}&quot; created. Now enroll their face on the machine running the recognition
            service:
          </p>
          <code className="mt-2 block rounded bg-slate-950 px-3 py-2 text-emerald-200">
            python scripts/enroll.py --name {justAdded.name}
          </code>
          <p className="mt-2 text-xs text-emerald-400/80">
            The name must match exactly - Phase 0 only knows enrollment folder names, not this dashboard&apos;s
            member IDs (see docs/phase1.md).
          </p>
          <button onClick={() => setJustAdded(null)} className="mt-2 text-xs text-emerald-400 underline">
            Dismiss
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Profile Photo</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created At</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.id} className="border-b border-slate-800/60 last:border-0">
                <td className="px-4 py-3">
                  {m.profilePhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external/arbitrary URL, not a static asset next/image can optimize
                    <img src={m.profilePhoto} alt={m.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm text-slate-300">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-200">{m.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      m.isActive ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {m.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">{new Date(m.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => handleToggleActive(m)} className="text-sm text-slate-400 hover:text-slate-200">
                      {m.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => handleDelete(m)} className="text-sm text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {members?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No members enrolled yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
