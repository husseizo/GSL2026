import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { api, isAuthenticated, setTokens } from '../api/client';

interface AuthContextValue {
  authenticated: boolean;
  login: (email: string, password: string, mfaToken?: string) => Promise<{ mfaRequired?: boolean }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  async function login(email: string, password: string, mfaToken?: string) {
    const result = await api.post<{ mfaRequired?: boolean; tokens?: { accessToken: string; refreshToken: string; expiresIn: number } }>(
      '/auth/login',
      { email, password, mfaToken },
    );
    if (result.mfaRequired) return { mfaRequired: true };
    setTokens(result.tokens!);
    setAuthenticated(true);
    return {};
  }

  function logout() {
    setTokens(null);
    setAuthenticated(false);
  }

  return <AuthContext.Provider value={{ authenticated, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
