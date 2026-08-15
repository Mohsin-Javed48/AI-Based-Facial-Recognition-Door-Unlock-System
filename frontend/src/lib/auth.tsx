'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

const STORAGE_KEY = 'gate-dashboard-token';

interface AuthContextValue {
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // localStorage doesn't exist on the server and can't be read during the
  // render pass without a client/server mismatch - this one-time hydration
  // on mount is the standard, unavoidable exception to "no setState in
  // effects" for browser-only storage.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(localStorage.getItem(STORAGE_KEY));
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { accessToken } = await api.login(username, password);
    localStorage.setItem(STORAGE_KEY, accessToken);
    setToken(accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    router.replace('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ token, isLoading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
