'use client';

import { api, type MeResponse } from '@/lib/api';
import { loadScope, saveScope, type ScopeSelection } from '@/lib/scope-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type ScopeContextValue = {
  scope: ScopeSelection | null;
  setScope: (scope: ScopeSelection) => void;
  me: MeResponse | null;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
};

const ScopeContext = createContext<ScopeContextValue | null>(null);

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [scope, setScopeState] = useState<ScopeSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const applyMe = useCallback((data: MeResponse) => {
    setMe(data);
    const stored = loadScope();
    const personalLabel = data.user.display_name ?? 'Personal';
    const validOrg = stored?.type === 'ORGANIZATION'
      ? data.organizations.find((o) => o.organization_id === stored.id)
      : null;

    if (stored?.type === 'ORGANIZATION' && validOrg) {
      setScopeState({
        type: 'ORGANIZATION',
        id: validOrg.organization_id,
        label: validOrg.name,
      });
    } else {
      setScopeState({
        type: 'PERSONAL',
        id: data.personalSpaceId,
        label: personalLabel,
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.me();
      applyMe(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [applyMe]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setScope = useCallback((next: ScopeSelection) => {
    saveScope(next);
    setScopeState(next);
  }, []);

  const value = useMemo(
    () => ({ scope, setScope, me, loading, error, refresh }),
    [scope, setScope, me, loading, error, refresh],
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error('useScope must be used within ScopeProvider');
  return ctx;
}
