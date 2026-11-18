'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';

export interface Me {
  user: { id: string; displayName: string; email: string };
  tenants: { id: string; code: string; name: string; dataMode: 'demo' | 'real' }[];
  active: null | {
    tenantId: string; tenantName: string; dataMode: 'demo' | 'real'; siteId: string | null; roles: string[]; permissions: string[];
    sites: { id: string; code: string; name: string; city: string }[];
  };
  modules: { code: string; name: string; hito: number; available: boolean }[];
}

interface SessionValue { me: Me | null; loading: boolean; error: ApiError | null; reload: () => Promise<void>; can: (p: string) => boolean }
const Ctx = createContext<SessionValue>({ me: null, loading: true, error: null, reload: async () => undefined, can: () => false });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const reload = useCallback(async () => {
    try {
      setMe(await api<Me>('/auth/me'));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const can = useCallback((p: string) => !!me?.active?.permissions.includes(p), [me]);
  return <Ctx.Provider value={{ me, loading, error, reload, can }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

/** Preferencias por usuario en este navegador (tema y transparencia). Tolerante a almacenamiento bloqueado. */
export function readPref(key: string, def: string): string {
  try { return localStorage.getItem(`nexus.${key}`) ?? def; } catch { return def; }
}
export function writePref(key: string, value: string): void {
  try { localStorage.setItem(`nexus.${key}`, value); } catch { /* sin almacenamiento */ }
}
