"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearDomainSourcesCache,
  fetchDomainSources,
  type DomainSourcesConfig,
} from "@/lib/api/research/domain-sources";

type Ctx = {
  config: DomainSourcesConfig | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const DomainSourcesContext = createContext<Ctx | undefined>(undefined);

export function DomainSourcesProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<DomainSourcesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      clearDomainSourcesCache();
      const c = await fetchDomainSources(true);
      setConfig(c);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ config, loading, error, refresh }),
    [config, loading, error, refresh],
  );

  return (
    <DomainSourcesContext.Provider value={value}>
      {children}
    </DomainSourcesContext.Provider>
  );
}

export function useDomainSources(): Ctx {
  const ctx = useContext(DomainSourcesContext);
  if (!ctx) {
    throw new Error("useDomainSources must be used within DomainSourcesProvider");
  }
  return ctx;
}
