'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Live Status' },
  { href: '/dashboard/access-log', label: 'Access Log' },
  { href: '/dashboard/members', label: 'Family Members' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace('/login');
    }
  }, [isLoading, token, router]);

  if (isLoading || !token) {
    return <div className="flex flex-1 items-center justify-center text-slate-400">Loading...</div>;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-100">Gate Access Dashboard</h1>
          <button onClick={logout} className="text-sm text-slate-400 hover:text-slate-200">
            Log out
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-t-md px-4 py-2 text-sm ${
                pathname === item.href
                  ? 'bg-slate-950 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
